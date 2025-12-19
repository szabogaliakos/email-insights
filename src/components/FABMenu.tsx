"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function FABMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const menuItems = [
    {
      label: "Dashboard",
      icon: "🏠",
      url: "/scan",
      color: "bg-blue-500 hover:bg-blue-600",
    },
    {
      label: "Settings",
      icon: "⚙️",
      url: "/settings",
      color: "bg-gray-500 hover:bg-gray-600",
    },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Menu Items */}
      <div
        className={`flex flex-col-reverse items-center gap-3 mb-4 transition-all duration-300 ${
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        {menuItems.map((item, index) => (
          <button
            key={item.label}
            onClick={() => {
              router.push(item.url);
              setIsOpen(false);
            }}
            className={`${item.color} text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer flex items-center gap-2 min-w-[120px]`}
            style={{
              transitionDelay: isOpen ? `${index * 50}ms` : "0ms",
            }}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Main FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-primary text-primary-foreground w-14 h-14 rounded-full shadow-lg transition-all duration-300 hover:scale-110 cursor-pointer flex items-center justify-center"
      >
        <span className={`text-2xl transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}>+</span>
      </button>
    </div>
  );
}
