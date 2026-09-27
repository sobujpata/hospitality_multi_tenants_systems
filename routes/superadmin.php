<?php

use App\Http\Controllers\SuperAdminAuditController;
use App\Http\Controllers\SuperAdminAuthController;
use App\Http\Controllers\SuperAdminCommunicationController;
use App\Http\Controllers\SuperAdminDashboardController;
use App\Http\Controllers\SuperAdminHealthController;
use App\Http\Controllers\SuperAdminTenantController;
use Illuminate\Support\Facades\Route;

Route::domain(env('APP_DOMAIN', 'localhost'))->prefix('admin')->group(function (): void {
    Route::middleware('guest:superadmin')->group(function (): void {
        Route::get('login', [SuperAdminAuthController::class, 'login'])->name('superadmin.login');
        Route::post('login', [SuperAdminAuthController::class, 'authenticate'])->name('superadmin.login.store');
    });

    Route::middleware(['auth:superadmin', 'superadmin.audit'])->group(function (): void {
        Route::get('dashboard', [SuperAdminDashboardController::class, 'index'])->name('superadmin.dashboard');
        Route::get('audit-logs', [SuperAdminAuditController::class, 'index'])->name('superadmin.audit.index');
        Route::get('health', [SuperAdminHealthController::class, 'index'])->name('superadmin.health');
        Route::post('health/failed-jobs/{id}/retry', [SuperAdminHealthController::class, 'retry'])->name('superadmin.health.failed-jobs.retry');
        Route::delete('health/failed-jobs/{id}', [SuperAdminHealthController::class, 'destroy'])->name('superadmin.health.failed-jobs.destroy');
        Route::get('communications', [SuperAdminCommunicationController::class, 'index'])->name('superadmin.communications.index');
        Route::post('communications/announcements', [SuperAdminCommunicationController::class, 'sendAnnouncement'])->name('superadmin.communications.announcements.store');
        Route::post('communications/support', [SuperAdminCommunicationController::class, 'recordSupportContact'])->name('superadmin.communications.support.store');
        Route::get('tenants', [SuperAdminTenantController::class, 'index'])->name('superadmin.tenants.index');
        Route::post('tenants', [SuperAdminTenantController::class, 'store'])->name('superadmin.tenants.store');
        Route::put('tenants/{tenant}', [SuperAdminTenantController::class, 'update'])->name('superadmin.tenants.update');
        Route::patch('tenants/{tenant}/status', [SuperAdminTenantController::class, 'updateStatus'])->name('superadmin.tenants.status');
        Route::delete('tenants/{tenant}', [SuperAdminTenantController::class, 'destroy'])->name('superadmin.tenants.destroy');
        Route::post('tenants/{tenant}/impersonate', [SuperAdminDashboardController::class, 'impersonate'])->name('superadmin.tenants.impersonate');
        Route::post('impersonation/stop', [SuperAdminDashboardController::class, 'stopImpersonation'])->name('superadmin.impersonation.stop');
        Route::put('tenants/{tenant}/billing', [SuperAdminDashboardController::class, 'override'])->name('superadmin.tenants.billing');
        Route::put('tenants/{tenant}/feature-flags', [SuperAdminDashboardController::class, 'flag'])->name('superadmin.tenants.feature-flags');
        Route::post('logout', [SuperAdminAuthController::class, 'logout'])->name('superadmin.logout');
    });
});
