import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { SqlDriver } from "@will-be-done/hyperdb/drivers/sqlite";
import { DB, syncDispatch, execSync, selectSync } from "@will-be-done/hyperdb";
import {
  backupStateTable,
  backupTierStateTable,
  backupFileTable,
  type BackupTier,
  getBackupById,
  getBackupsByTier,
  getCompletedBackupsByTier,
  getTierState,
  createBackup,
  startBackup,
  completeBackup,
  failBackup,
  updateTierState,
  createBackupFile,
  getBackupFiles,
  getBackupFilesByTierAndTime,
  deleteBackupWithFiles,
} from "./backupSlice";

describe("backup", () => {
  let db: DB;
  const selectBackupById = (id: string) =>
    selectSync(db, { selector: getBackupById, args: { id } });
  const selectBackupsByTier = (tier: BackupTier) =>
    selectSync(db, { selector: getBackupsByTier, args: { tier } });
  const selectCompletedBackupsByTier = (tier: BackupTier) =>
    selectSync(db, { selector: getCompletedBackupsByTier, args: { tier } });
  const selectBackupFiles = (backupId: string) =>
    selectSync(db, { selector: getBackupFiles, args: { backupId } });
  const selectBackupFilesByTierAndTime = (
    tier: BackupTier,
    scheduledAt: string,
  ) =>
    selectSync(db, {
      selector: getBackupFilesByTierAndTime,
      args: { tier, scheduledAt },
    });
  const selectTierState = (tier: BackupTier) =>
    selectSync(db, { selector: getTierState, args: { tier } });

  beforeEach(() => {
    // Create a fresh in-memory database for each test
    const sqliteDB = new Database(":memory:");

    type SqlValue = number | string | Uint8Array | null;
    const sqliteDriver = new SqlDriver({
      exec(sql: string, params?: SqlValue[]): void {
        if (!params) {
          sqliteDB.run(sql);
        } else {
          sqliteDB.run(sql, params);
        }
      },
      prepare(sql: string) {
        const stmt = sqliteDB.prepare(sql);
        return {
          query(params?: SqlValue[]): unknown[] {
            return params ? stmt.all(...params) : stmt.all();
          },
          exec(params?: SqlValue[]): void {
            if (params) {
              stmt.run(...params);
            } else {
              stmt.run();
            }
          },
          values(params?: SqlValue[]): SqlValue[][] {
            return (
              params ? stmt.values(...params) : stmt.values()
            ) as SqlValue[][];
          },
          finalize(): void {
            stmt.finalize();
          },
        };
      },
    });

    db = new DB(sqliteDriver);
    execSync(
      db.loadTables([backupStateTable, backupTierStateTable, backupFileTable]),
    );
  });

  describe("createBackup", () => {
    test("creates a pending backup with scheduled time", () => {
      const scheduledAt = "2026-02-03T12:00:00.000Z";

      const backupId = syncDispatch(
        db,
        createBackup({ tier: "hourly", scheduledAt }),
      );

      const backup = selectBackupById(backupId);

      expect(backup).toBeDefined();
      expect(backup?.id).toBe(backupId);
      expect(backup?.tier).toBe("hourly");
      expect(backup?.status).toBe("pending");
      expect(backup?.scheduledAt).toBe(scheduledAt);
      expect(backup?.startedAt).toBeNull();
      expect(backup?.completedAt).toBeNull();
      expect(backup?.totalSizeBytes).toBe(0);
      expect(backup?.durationMs).toBeNull();
      expect(backup?.error).toBeNull();
    });
  });

  describe("startBackup", () => {
    test("marks backup as running and sets startedAt", () => {
      const scheduledAt = "2026-02-03T12:00:00.000Z";
      const backupId = syncDispatch(
        db,
        createBackup({ tier: "hourly", scheduledAt }),
      );

      syncDispatch(db, startBackup({ id: backupId }));

      const backup = selectBackupById(backupId);
      expect(backup?.status).toBe("running");
      expect(backup?.startedAt).toBeDefined();
      expect(backup?.startedAt).not.toBeNull();
    });

    test("throws error if backup not found", () => {
      expect(() => {
        syncDispatch(db, startBackup({ id: "nonexistent-id" }));
      }).toThrow("Backup nonexistent-id not found");
    });
  });

  describe("completeBackup", () => {
    test("marks backup as completed with size and duration", () => {
      const scheduledAt = "2026-02-03T12:00:00.000Z";
      const backupId = syncDispatch(
        db,
        createBackup({ tier: "hourly", scheduledAt }),
      );
      syncDispatch(db, startBackup({ id: backupId }));

      syncDispatch(
        db,
        completeBackup({
          id: backupId,
          totalSizeBytes: 1024000,
          durationMs: 5000,
        }),
      );

      const backup = selectBackupById(backupId);
      expect(backup?.status).toBe("completed");
      expect(backup?.completedAt).toBeDefined();
      expect(backup?.totalSizeBytes).toBe(1024000);
      expect(backup?.durationMs).toBe(5000);
    });

    test("throws error if backup not found", () => {
      expect(() => {
        syncDispatch(
          db,
          completeBackup({
            id: "nonexistent-id",
            totalSizeBytes: 0,
            durationMs: 0,
          }),
        );
      }).toThrow("Backup nonexistent-id not found");
    });
  });

  describe("failBackup", () => {
    test("marks backup as failed with error message", () => {
      const scheduledAt = "2026-02-03T12:00:00.000Z";
      const backupId = syncDispatch(
        db,
        createBackup({ tier: "hourly", scheduledAt }),
      );
      syncDispatch(db, startBackup({ id: backupId }));

      syncDispatch(
        db,
        failBackup({ id: backupId, error: "Connection timeout" }),
      );

      const backup = selectBackupById(backupId);
      expect(backup?.status).toBe("failed");
      expect(backup?.completedAt).toBeDefined();
      expect(backup?.error).toBe("Connection timeout");
    });

    test("throws error if backup not found", () => {
      expect(() => {
        syncDispatch(db, failBackup({ id: "nonexistent-id", error: "error" }));
      }).toThrow("Backup nonexistent-id not found");
    });
  });

  describe("getBackupsByTier", () => {
    test("returns backups for specified tier in descending order", () => {
      syncDispatch(
        db,
        createBackup({
          tier: "hourly",
          scheduledAt: "2026-02-03T08:00:00.000Z",
        }),
      );
      syncDispatch(
        db,
        createBackup({
          tier: "hourly",
          scheduledAt: "2026-02-03T12:00:00.000Z",
        }),
      );
      syncDispatch(
        db,
        createBackup({
          tier: "daily",
          scheduledAt: "2026-02-03T00:00:00.000Z",
        }),
      );

      const hourlyBackups = selectBackupsByTier("hourly");

      expect(hourlyBackups).toHaveLength(2);
      // Should be in descending order (newest first)
      expect(hourlyBackups[0].scheduledAt).toBe("2026-02-03T12:00:00.000Z");
      expect(hourlyBackups[1].scheduledAt).toBe("2026-02-03T08:00:00.000Z");
    });

    test("returns empty array when no backups exist for tier", () => {
      const backups = selectBackupsByTier("weekly");
      expect(backups).toEqual([]);
    });
  });

  describe("getCompletedBackupsByTier", () => {
    test("returns only completed backups for specified tier", () => {
      const id1 = syncDispatch(
        db,
        createBackup({
          tier: "hourly",
          scheduledAt: "2026-02-03T08:00:00.000Z",
        }),
      );
      syncDispatch(db, startBackup({ id: id1 }));
      syncDispatch(
        db,
        completeBackup({ id: id1, totalSizeBytes: 1000, durationMs: 100 }),
      );

      const id2 = syncDispatch(
        db,
        createBackup({
          tier: "hourly",
          scheduledAt: "2026-02-03T12:00:00.000Z",
        }),
      );
      syncDispatch(db, startBackup({ id: id2 }));
      syncDispatch(db, failBackup({ id: id2, error: "error" }));

      syncDispatch(
        db,
        createBackup({
          tier: "hourly",
          scheduledAt: "2026-02-03T16:00:00.000Z",
        }),
      ); // Still pending

      const completedBackups = selectCompletedBackupsByTier("hourly");

      expect(completedBackups).toHaveLength(1);
      expect(completedBackups[0].id).toBe(id1);
      expect(completedBackups[0].status).toBe("completed");
    });
  });

  describe("createBackupFile", () => {
    test("creates a backup file record", () => {
      const backupId = syncDispatch(
        db,
        createBackup({
          tier: "hourly",
          scheduledAt: "2026-02-03T12:00:00.000Z",
        }),
      );

      const fileId = syncDispatch(
        db,
        createBackupFile({
          backupId,
          tier: "hourly",
          scheduledAt: "2026-02-03T12:00:00.000Z",
          fileName: "main.sqlite",
          s3Key: "backups/hourly/2026-02-03T12-00-00Z/main.sqlite",
          sizeBytes: 1024000,
          compressedSizeBytes: 153600,
          vacuumDurationMs: 5000,
          uploadDurationMs: 2000,
          compressionDurationMs: 300,
        }),
      );

      const files = selectBackupFiles(backupId);

      expect(files).toHaveLength(1);
      expect(files[0].id).toBe(fileId);
      expect(files[0].backupId).toBe(backupId);
      expect(files[0].tier).toBe("hourly");
      expect(files[0].scheduledAt).toBe("2026-02-03T12:00:00.000Z");
      expect(files[0].fileName).toBe("main.sqlite");
      expect(files[0].s3Key).toBe(
        "backups/hourly/2026-02-03T12-00-00Z/main.sqlite",
      );
      expect(files[0].sizeBytes).toBe(1024000);
      expect(files[0].vacuumDurationMs).toBe(5000);
      expect(files[0].uploadDurationMs).toBe(2000);
      expect(files[0].createdAt).toBeDefined();
    });
  });

  describe("getBackupFiles", () => {
    test("returns all files for a backup", () => {
      const backupId = syncDispatch(
        db,
        createBackup({
          tier: "hourly",
          scheduledAt: "2026-02-03T12:00:00.000Z",
        }),
      );

      syncDispatch(
        db,
        createBackupFile({
          backupId,
          tier: "hourly",
          scheduledAt: "2026-02-03T12:00:00.000Z",
          fileName: "main.sqlite",
          s3Key: "backups/hourly/2026-02-03T12-00-00Z/main.sqlite",
          sizeBytes: 1024000,
          compressedSizeBytes: 153600,
          vacuumDurationMs: 5000,
          uploadDurationMs: 2000,
          compressionDurationMs: 300,
        }),
      );

      syncDispatch(
        db,
        createBackupFile({
          backupId,
          tier: "hourly",
          scheduledAt: "2026-02-03T12:00:00.000Z",
          fileName: "space1.sqlite",
          s3Key: "backups/hourly/2026-02-03T12-00-00Z/space1.sqlite",
          sizeBytes: 2048000,
          compressedSizeBytes: 307200,
          vacuumDurationMs: 6000,
          uploadDurationMs: 3000,
          compressionDurationMs: 400,
        }),
      );

      const files = selectBackupFiles(backupId);

      expect(files).toHaveLength(2);
      expect(files.map((f) => f.fileName).sort()).toEqual([
        "main.sqlite",
        "space1.sqlite",
      ]);
    });

    test("returns empty array when no files exist", () => {
      const files = selectBackupFiles("nonexistent-id");
      expect(files).toEqual([]);
    });
  });

  describe("getBackupFilesByTierAndTime", () => {
    test("returns files for specified tier and scheduled time", () => {
      const backupId1 = syncDispatch(
        db,
        createBackup({
          tier: "hourly",
          scheduledAt: "2026-02-03T12:00:00.000Z",
        }),
      );
      syncDispatch(
        db,
        createBackupFile({
          backupId: backupId1,
          tier: "hourly",
          scheduledAt: "2026-02-03T12:00:00.000Z",
          fileName: "main.sqlite",
          s3Key: "backups/hourly/2026-02-03T12-00-00Z/main.sqlite",
          sizeBytes: 1024000,
          compressedSizeBytes: 153600,
          vacuumDurationMs: 5000,
          uploadDurationMs: 2000,
          compressionDurationMs: 300,
        }),
      );

      const backupId2 = syncDispatch(
        db,
        createBackup({
          tier: "hourly",
          scheduledAt: "2026-02-03T16:00:00.000Z",
        }),
      );
      syncDispatch(
        db,
        createBackupFile({
          backupId: backupId2,
          tier: "hourly",
          scheduledAt: "2026-02-03T16:00:00.000Z",
          fileName: "main.sqlite",
          s3Key: "backups/hourly/2026-02-03T16-00-00Z/main.sqlite",
          sizeBytes: 1024000,
          compressedSizeBytes: 153600,
          vacuumDurationMs: 5000,
          uploadDurationMs: 2000,
          compressionDurationMs: 300,
        }),
      );

      const files = selectBackupFilesByTierAndTime(
        "hourly",
        "2026-02-03T12:00:00.000Z",
      );

      expect(files).toHaveLength(1);
      expect(files[0].backupId).toBe(backupId1);
      expect(files[0].scheduledAt).toBe("2026-02-03T12:00:00.000Z");
    });
  });

  describe("deleteBackupWithFiles", () => {
    test("deletes backup and all associated files", () => {
      const backupId = syncDispatch(
        db,
        createBackup({
          tier: "hourly",
          scheduledAt: "2026-02-03T12:00:00.000Z",
        }),
      );

      syncDispatch(
        db,
        createBackupFile({
          backupId,
          tier: "hourly",
          scheduledAt: "2026-02-03T12:00:00.000Z",
          fileName: "main.sqlite",
          s3Key: "backups/hourly/2026-02-03T12-00-00Z/main.sqlite",
          sizeBytes: 1024000,
          compressedSizeBytes: 153600,
          vacuumDurationMs: 5000,
          uploadDurationMs: 2000,
          compressionDurationMs: 300,
        }),
      );

      syncDispatch(
        db,
        createBackupFile({
          backupId,
          tier: "hourly",
          scheduledAt: "2026-02-03T12:00:00.000Z",
          fileName: "space1.sqlite",
          s3Key: "backups/hourly/2026-02-03T12-00-00Z/space1.sqlite",
          sizeBytes: 2048000,
          compressedSizeBytes: 307200,
          vacuumDurationMs: 6000,
          uploadDurationMs: 3000,
          compressionDurationMs: 400,
        }),
      );

      // Verify files exist
      expect(selectBackupFiles(backupId)).toHaveLength(2);

      // Delete backup with files
      syncDispatch(db, deleteBackupWithFiles({ id: backupId }));

      // Verify both backup and files are deleted
      expect(selectBackupById(backupId)).toBeUndefined();
      expect(selectBackupFiles(backupId)).toHaveLength(0);
    });
  });

  describe("updateTierState", () => {
    test("creates new tier state if it doesn't exist", () => {
      syncDispatch(
        db,
        updateTierState({
          tier: "hourly",
          updates: {
            lastScheduledTime: "2026-02-03T12:00:00.000Z",
            nextScheduledTime: "2026-02-03T16:00:00.000Z",
            lastCompletedAt: "2026-02-03T12:05:00.000Z",
            consecutiveFailures: 0,
            isBackupInProgress: false,
          },
        }),
      );

      const tierState = selectTierState("hourly");

      expect(tierState).toBeDefined();
      expect(tierState?.tier).toBe("hourly");
      expect(tierState?.lastScheduledTime).toBe("2026-02-03T12:00:00.000Z");
      expect(tierState?.nextScheduledTime).toBe("2026-02-03T16:00:00.000Z");
      expect(tierState?.lastCompletedAt).toBe("2026-02-03T12:05:00.000Z");
      expect(tierState?.consecutiveFailures).toBe(0);
      expect(tierState?.isBackupInProgress).toBe(false);
    });

    test("updates existing tier state", () => {
      syncDispatch(
        db,
        updateTierState({
          tier: "hourly",
          updates: {
            lastScheduledTime: "2026-02-03T12:00:00.000Z",
            consecutiveFailures: 0,
          },
        }),
      );

      syncDispatch(
        db,
        updateTierState({
          tier: "hourly",
          updates: {
            lastScheduledTime: "2026-02-03T16:00:00.000Z",
            nextScheduledTime: "2026-02-03T20:00:00.000Z",
            consecutiveFailures: 1,
          },
        }),
      );

      const tierState = selectTierState("hourly");

      expect(tierState?.lastScheduledTime).toBe("2026-02-03T16:00:00.000Z");
      expect(tierState?.nextScheduledTime).toBe("2026-02-03T20:00:00.000Z");
      expect(tierState?.consecutiveFailures).toBe(1);
    });

    test("tracks consecutive failures", () => {
      syncDispatch(
        db,
        updateTierState({
          tier: "hourly",
          updates: { consecutiveFailures: 0 },
        }),
      );

      syncDispatch(
        db,
        updateTierState({
          tier: "hourly",
          updates: { consecutiveFailures: 1 },
        }),
      );

      syncDispatch(
        db,
        updateTierState({
          tier: "hourly",
          updates: { consecutiveFailures: 2 },
        }),
      );

      const tierState = selectTierState("hourly");
      expect(tierState?.consecutiveFailures).toBe(2);
    });

    test("manages backup in progress flag", () => {
      syncDispatch(
        db,
        updateTierState({
          tier: "hourly",
          updates: { isBackupInProgress: true },
        }),
      );

      let tierState = selectTierState("hourly");
      expect(tierState?.isBackupInProgress).toBe(true);

      syncDispatch(
        db,
        updateTierState({
          tier: "hourly",
          updates: { isBackupInProgress: false },
        }),
      );

      tierState = selectTierState("hourly");
      expect(tierState?.isBackupInProgress).toBe(false);
    });
  });

  describe("getTierState", () => {
    test("returns undefined when tier state doesn't exist", () => {
      const tierState = selectTierState("hourly");
      expect(tierState).toBeUndefined();
    });

    test("returns tier state when it exists", () => {
      syncDispatch(
        db,
        updateTierState({
          tier: "daily",
          updates: { lastScheduledTime: "2026-02-03T00:00:00.000Z" },
        }),
      );

      const tierState = selectTierState("daily");
      expect(tierState).toBeDefined();
      expect(tierState?.tier).toBe("daily");
    });
  });
});
