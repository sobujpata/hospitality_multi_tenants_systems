<?php

use App\Http\Controllers\Api\TenantAuthController;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\ReviewController;
use App\Http\Middleware\AuthenticateBroadcastingUser;
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

Route::middleware(['web', AuthenticateBroadcastingUser::class])->group(function (): void {
    Route::get('bookings/{booking}/conversation', [ConversationController::class, 'forBooking'])
        ->whereNumber('booking');
    Route::get('branches/{branch}/conversation', [ConversationController::class, 'forBranch'])
        ->whereNumber('branch');
    Route::post('conversations', [ConversationController::class, 'store']);
    Route::get('conversations', [ConversationController::class, 'index']);
    Route::put('conversations/{conversation}', [ConversationController::class, 'update'])
        ->whereNumber('conversation');
    Route::get('conversations/{conversation}/messages', [ConversationController::class, 'messages'])
        ->whereNumber('conversation');
    Route::post('conversations/{conversation}/messages', [MessageController::class, 'store'])
        ->whereNumber('conversation');
    Route::post('conversations/{conversation}/typing', [MessageController::class, 'typing'])
        ->whereNumber('conversation');
    Route::post('reviews', [ReviewController::class, 'store']);
});
