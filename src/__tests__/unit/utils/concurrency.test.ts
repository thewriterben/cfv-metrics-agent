import { describe, it, expect, beforeEach } from '@jest/globals';
import { executeConcurrent, executeBatchedConcurrent } from '../../../utils/concurrency.js';

describe('Concurrency Utils', () => {
  describe('executeConcurrent', () => {
    it('should execute tasks with concurrency limit', async () => {
      const results: number[] = [];
      const tasks = [
        async () => { await delay(10); results.push(1); return 1; },
        async () => { await delay(10); results.push(2); return 2; },
        async () => { await delay(10); results.push(3); return 3; },
        async () => { await delay(10); results.push(4); return 4; },
        async () => { await delay(10); results.push(5); return 5; }
      ];

      const startTime = Date.now();
      const taskResults = await executeConcurrent(tasks, 2);
      const duration = Date.now() - startTime;

      // With concurrency of 2, 5 tasks should take about 30ms (3 rounds: 2+2+1)
      expect(duration).toBeGreaterThanOrEqual(25);
      expect(duration).toBeLessThan(60);
      
      // Verify all results are successful
      expect(taskResults.every(r => r.success)).toBe(true);
      const values = taskResults.map(r => r.success ? r.value : null);
      expect(values).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle single task', async () => {
      const tasks = [async () => 'result'];
      const results = await executeConcurrent(tasks, 1);
      expect(results.length).toBe(1);
      expect(results[0].success).toBe(true);
      if (results[0].success) {
        expect(results[0].value).toBe('result');
      }
    });

    it('should handle errors in tasks', async () => {
      const tasks = [
        async () => 'success',
        async () => { throw new Error('failed'); },
        async () => 'success2'
      ];

      const results = await executeConcurrent(tasks, 2);
      
      expect(results[0].success).toBe(true);
      if (results[0].success) {
        expect(results[0].value).toBe('success');
      }
      
      expect(results[1].success).toBe(false);
      if (!results[1].success) {
        expect(results[1].error).toBeInstanceOf(Error);
        expect(results[1].error.message).toBe('failed');
      }
      
      expect(results[2].success).toBe(true);
      if (results[2].success) {
        expect(results[2].value).toBe('success2');
      }
    });

    it('should respect concurrency limit of 1 (sequential)', async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      const tasks = Array.from({ length: 5 }, () => async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await delay(10);
        concurrent--;
        return concurrent;
      });

      await executeConcurrent(tasks, 1);
      expect(maxConcurrent).toBe(1);
    });

    it('should allow higher concurrency', async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      const tasks = Array.from({ length: 10 }, () => async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await delay(10);
        concurrent--;
        return concurrent;
      });

      await executeConcurrent(tasks, 5);
      // Test proves some parallelism occurred (more than 1 concurrent task)
      expect(maxConcurrent).toBeGreaterThan(1);
      // Should not exceed the concurrency limit significantly
      expect(maxConcurrent).toBeLessThanOrEqual(5);
    });
  });

  describe('executeBatchedConcurrent', () => {
    it('should execute multiple groups in parallel with different concurrency limits', async () => {
      const taskGroups = {
        group1: [
          async () => { await delay(20); return 'g1-1'; },
          async () => { await delay(20); return 'g1-2'; },
          async () => { await delay(20); return 'g1-3'; }
        ],
        group2: [
          async () => { await delay(20); return 'g2-1'; },
          async () => { await delay(20); return 'g2-2'; }
        ]
      };

      const concurrencyLimits = {
        group1: 2,
        group2: 1
      };

      const startTime = Date.now();
      const results = await executeBatchedConcurrent(taskGroups, concurrencyLimits);
      const duration = Date.now() - startTime;

      // Groups run in parallel, so should take about 40ms (group2 is bottleneck)
      expect(duration).toBeGreaterThanOrEqual(35);
      expect(duration).toBeLessThan(80);

      expect(results.group1.length).toBe(3);
      expect(results.group2.length).toBe(2);
      
      // Check all results are successful
      expect(results.group1.every(r => r.success)).toBe(true);
      expect(results.group2.every(r => r.success)).toBe(true);
      
      const group1Values = results.group1.map(r => r.success ? r.value : null);
      const group2Values = results.group2.map(r => r.success ? r.value : null);
      
      expect(group1Values).toEqual(['g1-1', 'g1-2', 'g1-3']);
      expect(group2Values).toEqual(['g2-1', 'g2-2']);
    });

    it('should use default concurrency of 1 if not specified', async () => {
      const taskGroups = {
        group1: [
          async () => 'result1',
          async () => 'result2'
        ]
      };

      const results = await executeBatchedConcurrent(taskGroups, {});
      expect(results.group1.length).toBe(2);
      expect(results.group1.every(r => r.success)).toBe(true);
    });

    it('should handle empty groups', async () => {
      const taskGroups = {
        group1: []
      };

      const results = await executeBatchedConcurrent(taskGroups, { group1: 2 });
      expect(results.group1).toEqual([]);
    });
  });
});

// Helper function
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
