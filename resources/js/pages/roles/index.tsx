import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Permission = { id: number; name: string };
type Role = { id: number; name: string; permissions: Permission[] };

type Props = {
    roles: Role[];
    permissions: Permission[];
};

export default function RoleManager({ roles, permissions }: Props) {
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [name, setName] = useState('');
    const [selectedPermissions, setSelectedPermissions] = useState<number[]>(
        [],
    );
    const [processing, setProcessing] = useState(false);

    const editRole = (role: Role) => {
        setSelectedRole(role);
        setName(role.name);
        setSelectedPermissions(
            role.permissions.map((permission) => permission.id),
        );
    };

    const resetForm = () => {
        setSelectedRole(null);
        setName('');
        setSelectedPermissions([]);
    };

    const togglePermission = (permissionId: number, checked: boolean) => {
        setSelectedPermissions((current) =>
            checked
                ? [...current, permissionId]
                : current.filter((id) => id !== permissionId),
        );
    };

    const submit = () => {
        setProcessing(true);
        const options = {
            onFinish: () => setProcessing(false),
            onSuccess: resetForm,
        };
        const data = { name, permissions: selectedPermissions };

        if (selectedRole) {
            router.put(`/roles/${selectedRole.id}`, data, options);
        } else {
            router.post('/roles', data, options);
        }
    };

    const removeRole = (role: Role) => {
        if (window.confirm(`Delete the ${role.name} role?`)) {
            router.delete(`/roles/${role.id}`);
        }
    };

    return (
        <>
            <Head title="Role Manager" />
            <div className="space-y-6 p-4">
                <div>
                    <h1 className="text-2xl font-semibold">Role Manager</h1>
                    <p className="text-muted-foreground">
                        Create tenant roles and control their permissions.
                    </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                    <section className="rounded-xl border p-4">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="font-medium">Roles</h2>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={resetForm}
                            >
                                New role
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {roles.map((role) => (
                                <div
                                    key={role.id}
                                    className="flex items-center justify-between rounded-md border p-2"
                                >
                                    <button
                                        className="text-left text-sm hover:underline"
                                        onClick={() => editRole(role)}
                                    >
                                        {role.name}
                                    </button>
                                    {role.name !== 'Tenant Owner' && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeRole(role)}
                                        >
                                            Delete
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-xl border p-4">
                        <h2 className="mb-4 font-medium">
                            {selectedRole
                                ? `Edit ${selectedRole.name}`
                                : 'Create custom role'}
                        </h2>
                        <div className="mb-6 grid gap-2">
                            <Label htmlFor="role-name">Role name</Label>
                            <Input
                                id="role-name"
                                value={name}
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                                placeholder="e.g. Night Auditor"
                            />
                        </div>
                        <div className="overflow-x-auto rounded-md border">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium">
                                            Permission
                                        </th>
                                        <th className="px-4 py-3 text-center font-medium">
                                            Allowed
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {permissions.map((permission) => (
                                        <tr
                                            key={permission.id}
                                            className="border-t"
                                        >
                                            <td className="px-4 py-3">
                                                {permission.name}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Checkbox
                                                    checked={selectedPermissions.includes(
                                                        permission.id,
                                                    )}
                                                    onCheckedChange={(
                                                        checked,
                                                    ) =>
                                                        togglePermission(
                                                            permission.id,
                                                            checked === true,
                                                        )
                                                    }
                                                    aria-label={`Allow ${permission.name}`}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-6 flex gap-2">
                            <Button
                                onClick={submit}
                                disabled={processing || name.trim() === ''}
                            >
                                {selectedRole ? 'Save changes' : 'Create role'}
                            </Button>
                            {selectedRole && (
                                <Button variant="outline" onClick={resetForm}>
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}

RoleManager.layout = {
    breadcrumbs: [{ title: 'Role Manager', href: '/roles' }],
};
