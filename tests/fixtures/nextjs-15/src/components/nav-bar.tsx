import React, { useState } from "react";

interface NavLink {
  href: string;
  label: string;
}

const links: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

export function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="flex items-center justify-between border-b px-6 py-4">
      <a href="/" className="text-xl font-bold">
        MyApp
      </a>
      <div className="hidden gap-6 md:flex">
        {links.map((link) => (
          <a key={link.href} href={link.href} className="hover:text-blue-600">
            {link.label}
          </a>
        ))}
      </div>
      <button
        className="md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        Menu
      </button>
      {mobileOpen && (
        <div className="absolute left-0 top-16 w-full bg-white shadow-lg md:hidden">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="block px-6 py-3">
              {link.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}
