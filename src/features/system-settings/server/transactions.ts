import "server-only";

import type { TablesDB } from "node-appwrite";

type TransactionClient = Pick<TablesDB, "createTransaction" | "updateTransaction">;

export async function runTablesTransaction<T>(
  tables: TransactionClient,
  operation: (transactionId: string) => Promise<T>,
) {
  const transaction = await tables.createTransaction({ ttl: 60 });

  try {
    const result = await operation(transaction.$id);
    await tables.updateTransaction({
      commit: true,
      transactionId: transaction.$id,
    });

    return result;
  } catch (error) {
    try {
      await tables.updateTransaction({
        rollback: true,
        transactionId: transaction.$id,
      });
    } catch {
      // Preserve the original failure. Appwrite also expires uncommitted transactions.
    }

    throw error;
  }
}
