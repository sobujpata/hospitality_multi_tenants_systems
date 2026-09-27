<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'tenant_id', 'branch_id', 'name', 'email', 'phone', 'password', 'is_active',
    'department', 'designation', 'join_date', 'salary', 'employment_type',
    'shift_schedule', 'emergency_contact', 'documents', 'attendance_pin_hash',
    'attendance_qr_token',
])]
class Employee extends User
{
    protected $table = 'users';

    protected function casts(): array
    {
        return [
            ...parent::casts(),
            'join_date' => 'date',
            'salary' => 'decimal:2',
            'shift_schedule' => 'array',
            'emergency_contact' => 'array',
            'documents' => 'array',
        ];
    }

    public function shifts(): HasMany
    {
        return $this->hasMany(EmployeeShift::class, 'employee_id');
    }

    public function attendanceRecords(): HasMany
    {
        return $this->hasMany(AttendanceRecord::class, 'employee_id');
    }
}
