// src/components/Footer.jsx

import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    // The footer uses your theme colors like 'bg-card' and 'dark:bg-footer'
    <footer className="bg-card dark:bg-footer shadow-sm">
      <div className="w-full max-w-screen-xl mx-auto p-4 md:py-8">
        <span className="block text-sm text-text-secondary sm:text-center">
          © {new Date().getFullYear()} <Link to="/" className="hover:underline">Block Lease™</Link>. All Rights Reserved.
        </span>

      </div>
    </footer>
  );
}