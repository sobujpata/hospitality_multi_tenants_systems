<?php

use App\Http\Controllers\CustomerAuthController;
use App\Http\Controllers\CustomerPortalController;
use App\Http\Controllers\InvoiceController;
use App\Models\Branch;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome', [
        'branches' => Branch::withoutGlobalScopes()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'type', 'city', 'country', 'cover_image', 'star_rating']),
    ]);
})->name('home');

Route::get('login', [CustomerAuthController::class, 'showLogin'])
    ->name('central.customer.login');
Route::post('login', [CustomerAuthController::class, 'login'])
    ->name('central.customer.login.store');
Route::get('register', [CustomerAuthController::class, 'showRegister'])
    ->name('central.customer.register');
Route::post('register', [CustomerAuthController::class, 'register'])
    ->name('central.customer.register.store');
Route::get('portal/book', [CustomerPortalController::class, 'createBooking'])->name('central.portal.book');
Route::get('bookings/{booking}/invoice/download', [InvoiceController::class, 'download'])
    ->whereNumber('booking')
    ->middleware(['auth:customer', 'initialize.customer.tenant'])
    ->name('bookings.invoice.download');
Route::get('bookings/{booking}', [CustomerPortalController::class, 'showBooking'])
    ->whereNumber('booking')
    ->middleware('auth:customer')
    ->name('central.booking.show');
Route::middleware('auth:customer')->prefix('portal')->group(function (): void {
    Route::get('/', [CustomerPortalController::class, 'dashboard'])->name('central.portal.dashboard');
    Route::post('book', [CustomerPortalController::class, 'storeBooking'])->name('central.portal.book.store');
    Route::post('bookings/{booking}/modify', [CustomerPortalController::class, 'modification'])->name('central.portal.booking.modify');
    Route::post('bookings/{booking}/review', [CustomerPortalController::class, 'review'])->name('central.portal.booking.review');
    Route::get('bookings/{booking}/invoice', [CustomerPortalController::class, 'invoice'])->name('central.portal.booking.invoice');
    Route::post('bookings/{booking}/checkout', [CustomerPortalController::class, 'checkout'])->name('central.portal.booking.checkout');
    Route::get('profile', [CustomerAuthController::class, 'profile'])->name('central.portal.profile');
    Route::put('profile', [CustomerAuthController::class, 'updateProfile'])->name('central.portal.profile.update');
    Route::put('password', [CustomerAuthController::class, 'updatePassword'])->name('central.portal.password.update');
    Route::post('logout', [CustomerAuthController::class, 'logout'])->name('central.portal.logout');
});
