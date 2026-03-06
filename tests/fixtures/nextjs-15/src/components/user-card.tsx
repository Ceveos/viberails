import React from "react";

interface UserCardProps {
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

export function UserCard({ name, email, role, avatarUrl }: UserCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg border p-4">
      <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-200">
        {avatarUrl && (
          <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
        )}
      </div>
      <div>
        <h3 className="font-semibold">{name}</h3>
        <p className="text-sm text-gray-500">{email}</p>
        <span className="mt-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
          {role}
        </span>
      </div>
    </div>
  );
}
