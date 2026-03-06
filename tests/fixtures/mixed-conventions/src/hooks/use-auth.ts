import { useState } from 'react';
export function useAuth() {
  return useState(null);
}
