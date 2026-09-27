<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('department')->nullable()->after('is_active');
            $table->string('designation')->nullable()->after('department');
            $table->date('join_date')->nullable()->after('designation');
            $table->decimal('salary', 12, 2)->nullable()->after('join_date');
            $table->string('employment_type')->nullable()->after('salary');
            $table->json('shift_schedule')->nullable()->after('employment_type');
            $table->json('emergency_contact')->nullable()->after('shift_schedule');
            $table->json('documents')->nullable()->after('emergency_contact');
            $table->string('attendance_pin_hash')->nullable()->after('documents');
            $table->string('attendance_qr_token')->nullable()->unique()->after('attendance_pin_hash');
        });

        Schema::create('employee_shifts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('users')->cascadeOnDelete();
            $table->date('shift_date');
            $table->time('starts_at');
            $table->time('ends_at');
            $table->unsignedInteger('break_minutes')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['branch_id', 'shift_date']);
            $table->index(['employee_id', 'shift_date']);
        });

        Schema::create('attendance_records', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('users')->cascadeOnDelete();
            $table->date('attendance_date');
            $table->dateTime('clocked_in_at')->nullable();
            $table->dateTime('clocked_out_at')->nullable();
            $table->string('method')->default('pin');
            $table->boolean('is_late')->default(false);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['employee_id', 'attendance_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_records');
        Schema::dropIfExists('employee_shifts');
        Schema::table('users', function (Blueprint $table): void {
            $table->dropUnique(['attendance_qr_token']);
            $table->dropColumn([
                'department', 'designation', 'join_date', 'salary', 'employment_type',
                'shift_schedule', 'emergency_contact', 'documents', 'attendance_pin_hash',
                'attendance_qr_token',
            ]);
        });
    }
};
