<?php

use App\Http\Controllers\AmenityController;
use App\Http\Controllers\BillingController;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\BranchController;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PermissionManagerController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RoleManagerController;
use App\Http\Controllers\StaffSchedulingController;
use App\Http\Controllers\TaskManagementController;
use App\Http\Controllers\TenantAuthController;
use App\Http\Controllers\TenantSettingsController;
use App\Http\Controllers\UnitCategoryController;
use App\Http\Controllers\UnitController;
use App\Http\Controllers\UserManagerController;
use Illuminate\Support\Facades\Route;

Route::domain('{tenant}.'.env('APP_DOMAIN', 'localhost'))
    ->middleware(['initialize.tenancy'])
    ->group(function (): void {
        Route::get('login', [TenantAuthController::class, 'login'])->name('tenant.login');
        Route::post('login', [TenantAuthController::class, 'authenticate'])->name('tenant.login.store');
        Route::get('register', [TenantAuthController::class, 'register'])->name('tenant.register');
        Route::post('register', [TenantAuthController::class, 'store'])->name('tenant.register.store');
        Route::get('forgot-password', [TenantAuthController::class, 'forgotPassword'])->name('tenant.password.request');
        Route::post('forgot-password', [TenantAuthController::class, 'sendResetLink'])->name('tenant.password.email');
        Route::get('reset-password/{token}', [TenantAuthController::class, 'resetPassword'])->name('tenant.password.reset');
        Route::post('reset-password', [TenantAuthController::class, 'updatePassword'])->name('tenant.password.update');
    });

Route::domain('{tenant?}.'.env('APP_DOMAIN', 'localhost'))
    ->middleware(['initialize.tenancy'])
    ->group(function (): void {
        Route::middleware(['auth'])->group(function (): void {
            Route::get('settings/tenant', [TenantSettingsController::class, 'index'])->name('tenant.settings');
            Route::match(['put', 'post'], 'settings/tenant/general', [TenantSettingsController::class, 'general'])->name('tenant.settings.general');
            Route::put('settings/tenant/booking', [TenantSettingsController::class, 'booking'])->name('tenant.settings.booking');
            Route::put('settings/tenant/branding', [TenantSettingsController::class, 'branding'])->name('tenant.settings.branding');
            Route::put('settings/tenant/templates/{template}', [TenantSettingsController::class, 'template'])->name('tenant.settings.template');
            Route::post('settings/tenant/integrations', [TenantSettingsController::class, 'integration'])->name('tenant.settings.integration');
            Route::delete('settings/tenant/integrations/{integration}', [TenantSettingsController::class, 'destroyIntegration'])->name('tenant.settings.integration.destroy');
            Route::get('settings/notifications', [NotificationController::class, 'index'])->name('notifications.index');
            Route::put('settings/notifications', [NotificationController::class, 'update'])->name('notifications.update');
            Route::post('notifications/{notification}/read', [NotificationController::class, 'read'])->name('notifications.read');
            Route::get('billing', [BillingController::class, 'index'])->name('billing.index');
            Route::post('billing/subscribe', [BillingController::class, 'subscribe'])->name('billing.subscribe');
            Route::post('billing/payment-method', [BillingController::class, 'paymentMethod'])->name('billing.payment-method');
            Route::get('billing/invoices/{invoice}', [BillingController::class, 'invoice'])->name('billing.invoice');
        });

        Route::middleware(['auth', 'billing.access'])->group(function (): void {
            Route::get('dashboard', DashboardController::class)->name('dashboard');
            Route::get('inbox', [ConversationController::class, 'inbox'])
                ->name('inbox.index');
            Route::get('bookings/timeline', [BookingController::class, 'index'])->name('bookings.timeline');
            Route::get('bookings/availability', [BookingController::class, 'availability'])->name('bookings.availability');
            Route::get('channels', [BookingController::class, 'channels'])
                ->middleware('feature:beta_channel_manager')
                ->name('channels.index');
            Route::middleware('feature:advanced_reports')->group(function (): void {
                Route::get('reports', [ReportController::class, 'index'])->name('reports.index');
                Route::get('reports/export', [ReportController::class, 'export'])->name('reports.export');
                Route::post('report-schedules', [ReportController::class, 'storeSchedule'])->name('report-schedules.store');
                Route::delete('report-schedules/{schedule}', [ReportController::class, 'destroySchedule'])->name('report-schedules.destroy');
            });
            Route::get('staff/scheduling', [StaffSchedulingController::class, 'index'])->name('staff.scheduling');
            Route::post('staff/shifts', [StaffSchedulingController::class, 'store'])->name('staff.shifts.store');
            Route::put('staff/shifts/{shift}', [StaffSchedulingController::class, 'update'])->name('staff.shifts.update');
            Route::get('staff/shifts/report', [StaffSchedulingController::class, 'report'])->name('staff.shifts.report');
            Route::get('staff/attendance', [StaffSchedulingController::class, 'attendance'])->name('staff.attendance');
            Route::post('staff/attendance/clock', [StaffSchedulingController::class, 'clock'])->name('staff.attendance.clock');
            Route::post('staff/{employee}/attendance-token', [StaffSchedulingController::class, 'employeeToken'])->name('staff.attendance.token');
            Route::get('housekeeping', [TaskManagementController::class, 'housekeeping'])->name('housekeeping.board');
            Route::get('tasks', [TaskManagementController::class, 'tasks'])->name('tasks.index');
            Route::post('tasks', [TaskManagementController::class, 'storeTask'])->name('tasks.store');
            Route::put('tasks/{task}', [TaskManagementController::class, 'updateTask'])->name('tasks.update');
            Route::get('maintenance', [TaskManagementController::class, 'maintenance'])->name('maintenance.index');
            Route::post('maintenance', [TaskManagementController::class, 'storeMaintenance'])->name('maintenance.store');
            Route::put('maintenance/{maintenanceRequest}', [TaskManagementController::class, 'updateMaintenance'])->name('maintenance.update');
            Route::put('bookings/{booking}/dates', [BookingController::class, 'updateDates'])->name('bookings.dates.update');
            Route::get('roles', [RoleManagerController::class, 'index'])->name('roles.index');
            Route::post('roles', [RoleManagerController::class, 'store'])->name('roles.store');
            Route::put('roles/{role}', [RoleManagerController::class, 'update'])->name('roles.update');
            Route::delete('roles/{role}', [RoleManagerController::class, 'destroy'])->name('roles.destroy');
            Route::get('users', [UserManagerController::class, 'index'])->name('users.index');
            Route::post('users', [UserManagerController::class, 'store'])->name('users.store');
            Route::put('users/{user}', [UserManagerController::class, 'update'])->name('users.update');
            Route::delete('users/{user}', [UserManagerController::class, 'destroy'])->name('users.destroy');
            Route::get('permissions', [PermissionManagerController::class, 'index'])->name('permissions.index');
            Route::post('permissions', [PermissionManagerController::class, 'store'])->name('permissions.store');
            Route::put('permissions/{permission}', [PermissionManagerController::class, 'update'])->name('permissions.update');
            Route::delete('permissions/{permission}', [PermissionManagerController::class, 'destroy'])->name('permissions.destroy');
            Route::get('branches', [BranchController::class, 'index'])->name('branches.index');
            Route::post('branches', [BranchController::class, 'store'])->name('branches.store');
            Route::put('branches/{branch}', [BranchController::class, 'update'])->name('branches.update');
            Route::delete('branches/{branch}', [BranchController::class, 'destroy'])->name('branches.destroy');
            Route::post('branch/switch', [BranchController::class, 'switch'])->name('branches.switch');
            Route::put('branches/{branch}/settings', [BranchController::class, 'settings'])->name('branches.settings');
            Route::get('units', [UnitController::class, 'index'])->name('units.index');
            Route::post('units', [UnitController::class, 'store'])->name('units.store');
            Route::put('units/{unit}', [UnitController::class, 'update'])->name('units.update');
            Route::delete('units/{unit}', [UnitController::class, 'destroy'])->name('units.destroy');
            Route::post('units/bulk-status', [UnitController::class, 'bulkStatus'])->name('units.bulk-status');
            Route::get('room-category', [UnitCategoryController::class, 'index'])->name('unit-categories.index');
            Route::post('unit-categories', [UnitCategoryController::class, 'store'])->name('unit-categories.store');
            Route::put('unit-categories/{unitCategory}', [UnitCategoryController::class, 'update'])->name('unit-categories.update');
            Route::delete('unit-categories/{unitCategory}', [UnitCategoryController::class, 'destroy'])->name('unit-categories.destroy');
            Route::get('amenities', [AmenityController::class, 'index'])->name('amenities.index');
            Route::post('amenities', [AmenityController::class, 'store'])->name('amenities.store');
            Route::put('amenities/{amenity}', [AmenityController::class, 'update'])->name('amenities.update');
            Route::delete('amenities/{amenity}', [AmenityController::class, 'destroy'])->name('amenities.destroy');
            Route::get('customers', [CustomerController::class, 'index'])->name('customers.index');
            Route::post('customers', [CustomerController::class, 'store'])->name('customers.store');
            Route::post('customers/walk-in-booking', [CustomerController::class, 'storeWalkInBooking'])->name('customers.walk-in-booking');
            Route::get('customers/{customer}', [CustomerController::class, 'show'])->name('customers.show');
            Route::put('customers/{customer}', [CustomerController::class, 'update'])->name('customers.update');
            Route::post('customers/{customer}/documents', [CustomerController::class, 'uploadDocument'])->name('customers.documents');
            Route::post('customers/{customer}/merge', [CustomerController::class, 'merge'])->name('customers.merge');
            Route::post('two-factor/enable', [TenantAuthController::class, 'enableTwoFactor'])
                ->name('tenant.two-factor.enable');
            Route::post('two-factor/confirm', [TenantAuthController::class, 'confirmTwoFactor'])
                ->name('tenant.two-factor.confirm');
        });

        Route::post('channels/webhooks/{token}', [BookingController::class, 'channelWebhook'])
            ->middleware('feature:beta_channel_manager')
            ->name('channels.webhook');

        require __DIR__.'/settings.php';
    });
