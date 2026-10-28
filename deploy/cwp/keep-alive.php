<?php
/**
 * Rearranque de los servicios si se cayeron.
 * Lo invoca cron cada cinco minutos. Sale enseguida: no espera al proceso que arranca.
 * No toca datos.
 */
$home = '/home/finance/market';
putenv('XDG_RUNTIME_DIR=/run/user/1002');
putenv('OPENBLAS_NUM_THREADS=1');
putenv('OMP_NUM_THREADS=1');
putenv('HOME=/home/finance');

function run_cmd(string $cmd): int
{
    $code = 0;
    exec($cmd, $unused, $code);
    return $code;
}

function http_up(string $url): bool
{
    $cmd = '/usr/bin/curl -fsS -m 5 -o /dev/null ' . escapeshellarg($url);
    return run_cmd($cmd) === 0;
}

function process_lines(): array
{
    $raw = (string) shell_exec('ps -u finance -o pid=,cmd=');
    $lines = [];
    foreach (explode("\n", $raw) as $line) {
        $line = trim($line);
        if ($line !== '') {
            $lines[] = $line;
        }
    }
    return $lines;
}

function running(array $lines, string $needle): bool
{
    foreach ($lines as $line) {
        if (strpos($line, $needle) !== false) {
            return true;
        }
    }
    return false;
}

function spawn_detached(string $cwd, string $cmd, string $log): void
{
    global $home;
    $code = 'import subprocess,sys; subprocess.Popen(sys.argv[1], cwd=sys.argv[2], shell=True, start_new_session=True, stdin=subprocess.DEVNULL, stdout=open(sys.argv[3],"a"), stderr=subprocess.STDOUT)';
    $full = escapeshellarg($home . '/venv/bin/python')
        . ' -c ' . escapeshellarg($code)
        . ' ' . escapeshellarg($cmd)
        . ' ' . escapeshellarg($cwd)
        . ' ' . escapeshellarg($log);
    exec($full);
}

$lines = process_lines();

if (run_cmd($home . '/pgsql/bin/pg_isready -h 127.0.0.1 -p 5432') !== 0 && !running($lines, 'postgres -D')) {
    spawn_detached($home, $home . '/pgsql/bin/pg_ctl -D ' . $home . '/pgdata -l ' . $home . '/postgres.log start', $home . '/postgres.log');
}

$redis = $home . '/redis/bin/redis-cli -h 127.0.0.1';
if (run_cmd($redis . ' ping') !== 0) {
    run_cmd($redis . ' CONFIG SET stop-writes-on-bgsave-error no');
    if (run_cmd($redis . ' ping') !== 0 && !running($lines, 'redis-server')) {
        spawn_detached($home, $home . '/redis/bin/redis-server ' . $home . '/redis.conf --daemonize yes', $home . '/redis.log');
    }
}

if (!http_up('http://127.0.0.1:8000/health') && !running($lines, 'uvicorn app.main:app')) {
    spawn_detached(
        $home . '/src',
        $home . '/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --env-file ' . $home . '/.env',
        $home . '/api.log'
    );
}

if (!http_up('http://127.0.0.1:3000/login') && !running($lines, 'next-server') && !running($lines, 'npm run start')) {
    spawn_detached(
        $home . '/src/frontend',
        '/usr/local/bin/npm run start -- --hostname 127.0.0.1 --port 3000',
        $home . '/web.log'
    );
}
