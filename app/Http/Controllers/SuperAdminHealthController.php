<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Queue\RedisQueue;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class SuperAdminHealthController extends Controller
{
    public function index(): Response
    {
        $connection = config('queue.default');
        $queueConfig = config("queue.connections.{$connection}");
        $queue = app('queue')->connection($connection);
        $pendingJobs = 0;
        $processingJobs = 0;

        if ($queueConfig['driver'] === 'database') {
            $queueTable = $queueConfig['table'] ?? 'jobs';
            $queueDatabase = DB::connection($queueConfig['connection'] ?? config('database.default'));
            $processingJobs = $queueDatabase->table($queueTable)->whereNotNull('reserved_at')->count();
            $pendingJobs = $queueDatabase->table($queueTable)->whereNull('reserved_at')->count();
        } elseif ($queue instanceof RedisQueue) {
            $pendingJobs = $queue->totalPendingSize() + $queue->totalDelayedSize();
            $processingJobs = $queue->totalReservedSize();
        } elseif ($queueConfig['driver'] === 'sync') {
            $pendingJobs = 0;
            $processingJobs = 0;
        }

        $failedJobs = app('queue.failer')->all();
        $failedJobs = collect($failedJobs)->map(function (object $failedJob): array {
            $payload = json_decode($failedJob->payload, true);
            $exception = preg_split('/\r?\n/', $failedJob->exception, 2)[0] ?? 'Unknown exception';

            return [
                'id' => (string) $failedJob->id,
                'connection' => $failedJob->connection,
                'queue' => $failedJob->queue,
                'job' => $payload['displayName'] ?? $payload['job'] ?? 'Unknown job',
                'failed_at' => $failedJob->failed_at,
                'exception' => mb_substr($exception, 0, 500),
            ];
        })->values();

        $redisStats = $this->redisStats();
        $queryMeasurements = $this->measureDatabaseQueries();

        return Inertia::render('superadmin/health', [
            'queue' => [
                'connection' => $connection,
                'driver' => $queueConfig['driver'],
                'pending' => $pendingJobs,
                'processing' => $processingJobs,
            ],
            'failedJobs' => $failedJobs,
            'failedJobsCount' => $failedJobs->count(),
            'cache' => $redisStats,
            'database' => $queryMeasurements,
        ]);
    }

    public function retry(string $id): RedirectResponse
    {
        $failedJob = app('queue.failer')->find($id);

        abort_if($failedJob === null, 404, 'Failed job not found.');

        $exitCode = Artisan::call('queue:retry', ['id' => [$id]]);

        abort_if($exitCode !== 0, 500, 'Unable to retry the failed job.');

        return back()->with('status', 'Failed job queued for retry.');
    }

    public function destroy(string $id): RedirectResponse
    {
        $deleted = app('queue.failer')->forget($id);

        abort_unless($deleted, 404, 'Failed job not found.');

        return back()->with('status', 'Failed job deleted.');
    }

    /**
     * @return array{hit_rate: string, hits: int|null, misses: int|null, status: string}
     */
    private function redisStats(): array
    {
        try {
            $stats = Redis::connection()->info('stats');
            $hits = (int) ($stats['keyspace_hits'] ?? 0);
            $misses = (int) ($stats['keyspace_misses'] ?? 0);
            $total = $hits + $misses;

            return [
                'hit_rate' => $total ? round($hits / $total * 100, 1).'%' : 'No samples',
                'hits' => $hits,
                'misses' => $misses,
                'status' => 'Connected',
            ];
        } catch (Throwable $exception) {
            report($exception);

            return [
                'hit_rate' => 'Unavailable',
                'hits' => null,
                'misses' => null,
                'status' => 'Unavailable',
            ];
        }
    }

    /**
     * @return array{average_ms: float, samples: int, measurement: string}
     */
    private function measureDatabaseQueries(): array
    {
        $startedAt = hrtime(true);
        DB::select('SELECT 1');
        $elapsedMilliseconds = (hrtime(true) - $startedAt) / 1_000_000;

        return [
            'average_ms' => round($elapsedMilliseconds, 2),
            'samples' => 1,
            'measurement' => 'Database health-check query latency.',
        ];
    }
}
