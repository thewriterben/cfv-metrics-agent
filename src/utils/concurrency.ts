/**
 * Concurrency Control Utilities
 * 
 * Provides utilities for managing concurrent async operations with limits.
 */

/**
 * Result type for concurrent execution
 */
export type ConcurrentResult<T> = 
  | { success: true; value: T }
  | { success: false; error: Error };

/**
 * Execute tasks with a concurrency limit using a queue pattern
 * 
 * @param tasks - Array of task functions to execute
 * @param concurrency - Maximum number of concurrent tasks
 * @returns Promise that resolves to array of results
 */
export async function executeConcurrent<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<ConcurrentResult<T>[]> {
  const results: ConcurrentResult<T>[] = new Array(tasks.length);
  let currentIndex = 0;
  
  // Worker function that processes tasks from the queue
  async function worker(): Promise<void> {
    while (currentIndex < tasks.length) {
      const index = currentIndex++;
      const task = tasks[index];
      
      try {
        const value = await task();
        results[index] = { success: true, value };
      } catch (error) {
        results[index] = { 
          success: false, 
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    }
  }
  
  // Create worker pool
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, tasks.length); i++) {
    workers.push(worker());
  }
  
  // Wait for all workers to complete
  await Promise.all(workers);
  
  return results;
}

/**
 * Execute tasks in batches with concurrency limit
 * Groups tasks and executes each group with the specified concurrency
 * 
 * @param taskGroups - Object mapping group names to arrays of tasks
 * @param concurrencyPerGroup - Concurrency limit for each group
 * @returns Promise that resolves to object mapping group names to results
 */
export async function executeBatchedConcurrent<T>(
  taskGroups: Record<string, Array<() => Promise<T>>>,
  concurrencyPerGroup: Record<string, number>
): Promise<Record<string, ConcurrentResult<T>[]>> {
  const results: Record<string, ConcurrentResult<T>[]> = {};
  
  // Execute all groups in parallel, but with concurrency limits within each group
  await Promise.all(
    Object.entries(taskGroups).map(async ([groupName, tasks]) => {
      const concurrency = concurrencyPerGroup[groupName] || 1;
      results[groupName] = await executeConcurrent(tasks, concurrency);
    })
  );
  
  return results;
}
