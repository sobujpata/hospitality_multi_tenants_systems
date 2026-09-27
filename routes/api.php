<?php

use App\Http\Controllers\Api\TenantAuthController;
use Illuminate\Support\Facades\Route;

Route::domain('{tenant?}.'.env('APP_DOMAIN', 'localhost'))
    ->middleware(['initialize.tenancy'])
    ->prefix('tenant')
    ->group(function (): void {
        Route::post('login', [TenantAuthController::class, 'login']);

        Route::middleware(['auth:sanctum', 'feature:api_access'])->group(function (): void {
            Route::get('user', [TenantAuthController::class, 'user']);
            Route::post('logout', [TenantAuthController::class, 'logout']);
        });
    });
