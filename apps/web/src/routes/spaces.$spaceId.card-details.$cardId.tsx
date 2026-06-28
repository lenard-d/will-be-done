import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { CardDetailsPage } from "@/components/CardDetails/CardDetails.tsx";
import { GlobalLayout } from "@/components/Layout/GlobalLayout.tsx";
import { preloadSelector } from "@will-be-done/hyperdb";
import {
  cardExists,
  checklistItemChildren,
  dailyProjectionDateOfTask,
  isTask,
  isTaskTemplate,
  projectCategoriesByProjectId,
  projectCategoryCardById,
  projectOfCategoryOrDefault,
  taskTemplateById,
  taskTemplateRuleText,
} from "@will-be-done/slices/space";

export const Route = createFileRoute("/spaces/$spaceId/card-details/$cardId")({
  component: RouteComponent,
  loader: async ({ context, params }) => {
    const db = await context.spaceDbPromise;
    const promises: Promise<unknown>[] = [];
    const appendPromise = (promise: Promise<unknown>) => {
      promises.push(promise);
    };

    appendPromise(preloadSelector(db, cardExists, { id: params.cardId }));

    const card = await preloadSelector(db, projectCategoryCardById, {
      id: params.cardId,
    });

    if (!card) {
      await Promise.all(promises);
      return;
    }

    appendPromise(
      preloadSelector(db, checklistItemChildren, {
        parentId: card.id,
        parentType: card.type,
      }),
    );

    const project = await preloadSelector(db, projectOfCategoryOrDefault, {
      categoryId: card.projectCategoryId,
    });

    appendPromise(
      preloadSelector(db, projectCategoriesByProjectId, {
        projectId: project.id,
      }),
    );

    if (isTask(card)) {
      appendPromise(
        preloadSelector(db, dailyProjectionDateOfTask, { taskId: card.id }),
      );

      if (card.templateId) {
        appendPromise(
          preloadSelector(db, taskTemplateById, { id: card.templateId }),
        );
        appendPromise(
          preloadSelector(db, taskTemplateRuleText, { id: card.templateId }),
        );
      }
    }

    if (isTaskTemplate(card)) {
      appendPromise(preloadSelector(db, taskTemplateRuleText, { id: card.id }));
    }

    await Promise.all(promises);
  },
});

function RouteComponent() {
  const { cardId, spaceId } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();

  const handleBack = () => {
    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }

    void navigate({
      to: "/spaces/$spaceId/dates",
      params: { spaceId },
    });
  };

  const handleCardIdChange = (nextCardId: string) => {
    void navigate({
      to: "/spaces/$spaceId/card-details/$cardId",
      params: { spaceId, cardId: nextCardId },
      replace: true,
    });
  };

  return (
    <GlobalLayout>
      <main className="flex min-h-0 w-full justify-center">
        <CardDetailsPage
          cardId={cardId}
          onBack={handleBack}
          onCardIdChange={handleCardIdChange}
        />
      </main>
    </GlobalLayout>
  );
}
