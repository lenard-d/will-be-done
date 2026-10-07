import { expect, test } from "playwright/test";

test("updates and removes global handlers before the next layout event", async ({
  page,
}) => {
  await page.goto("/signup");

  const results = await page.evaluate(async () => {
    const reactPath = "/node_modules/.vite/deps/react.js";
    const reactDOMPath = "/node_modules/.vite/deps/react-dom_client.js";
    const hooksPath = "/src/components/GlobalListener/hooks.tsx";
    const { createElement, useLayoutEffect } = (await import(reactPath))
      .default;
    const { createRoot } = (await import(reactDOMPath)).default;
    const { useGlobalListener, useEventTypes } = await import(hooksPath);
    const calls: string[] = [];
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    const dispatchRegisteredHandlers = (event: Event) => {
      const handlers = useEventTypes.getState().callbacks.get("resize");
      for (const handler of handlers?.values() ?? []) handler(event);
    };
    window.addEventListener("resize", dispatchRegisteredHandlers);

    function Listener({ value }: { value: string }) {
      useGlobalListener("resize", () => calls.push(value));
      return null;
    }

    function Commit({
      value,
      complete,
    }: {
      value: string | null;
      complete: () => void;
    }) {
      useLayoutEffect(() => {
        window.dispatchEvent(new Event("resize"));
        complete();
      }, [value, complete]);
      return value === null ? null : createElement(Listener, { value });
    }

    async function render(value: string | null) {
      await new Promise<void>((resolve) => {
        root.render(createElement(Commit, { value, complete: resolve }));
      });
    }

    try {
      await render("first");
      const mounted = [...calls];
      await render("second");
      const updated = [...calls];
      await render(null);
      return { mounted, updated, removed: [...calls] };
    } finally {
      root.unmount();
      host.remove();
      window.removeEventListener("resize", dispatchRegisteredHandlers);
    }
  });

  expect(results).toEqual({
    mounted: ["first"],
    updated: ["first", "second"],
    removed: ["first", "second"],
  });
});
