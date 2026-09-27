<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('dashboard:refresh')->hourly();
Schedule::command('reports:send-scheduled')->hourly();
Schedule::command('tenants:send-trial-prompts')->dailyAt('09:00');
Schedule::command('notifications:send-operational')->hourly();
