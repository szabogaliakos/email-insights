"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchAuthUrl();
  }, []);

  const fetchAuthUrl = async () => {
    const res = await fetch("/api/auth/url");
    if (!res.ok) return;
    const json = await res.json();
    setAuthUrl(json.url);
  };

  const handleConnect = () => {
    if (authUrl) {
      window.location.href = authUrl;
    }
  };

  const handleGetStarted = () => {
    if (authUrl) {
      window.location.href = authUrl;
    } else {
      router.push("/auth/login");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/50 via-purple-900/30 to-black/80"></div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-32 text-center">
          <div className="mb-8">
            <h1 className="text-6xl font-bold text-white mb-6 bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-300 bg-clip-text text-transparent leading-tight">
              Organize Your Gmail Inbox — Effortlessly
            </h1>
            <div className="w-32 h-1 bg-gradient-to-r from-cyan-400 to-purple-400 mx-auto mb-8 rounded-full"></div>
            <p className="text-2xl text-gray-300 max-w-4xl mx-auto mb-8 leading-relaxed">
              Turn 38,000 emails into a clean, structured inbox with smart labels.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Button
              size="lg"
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white text-xl px-12 py-4 rounded-xl shadow-2xl shadow-cyan-500/25 transform hover:scale-105 transition-all duration-300 font-semibold"
              onPress={handleGetStarted}
            >
              🚀 Get Started
            </Button>
          </div>
        </div>

        {/* Floating Elements */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-cyan-400/20 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute top-40 right-20 w-32 h-32 bg-purple-500/20 rounded-full blur-xl animate-pulse animation-delay-1000"></div>
        <div className="absolute bottom-20 left-1/4 w-24 h-24 bg-blue-400/20 rounded-full blur-xl animate-pulse animation-delay-2000"></div>
      </section>

      {/* The Problem */}
      <section className="py-32 bg-background/50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-5xl font-bold text-white mb-6">The Problem</h2>
          <p className="text-xl text-gray-300 mb-12">Your inbox is messy. Important messages disappear.</p>

          <div className="space-y-6 text-left max-w-2xl mx-auto">
            <div className="flex items-start space-x-4">
              <span className="text-cyan-400 text-2xl">•</span>
              <p className="text-gray-300">You have tens of thousands of emails</p>
            </div>
            <div className="flex items-start space-x-4">
              <span className="text-cyan-400 text-2xl">•</span>
              <p className="text-gray-300">Senders are buried under noise</p>
            </div>
            <div className="flex items-start space-x-4">
              <span className="text-cyan-400 text-2xl">•</span>
              <p className="text-gray-300">Finding past conversations is slow and frustrating</p>
            </div>
          </div>

          <p className="text-lg text-gray-400 mt-8">Gmail labels exist — but managing them at scale is painful.</p>
        </div>
      </section>

      {/* The Solution */}
      <section className="py-32 bg-gradient-to-r from-cyan-900/20 via-blue-900/20 to-purple-900/20 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-5xl font-bold text-white mb-6">The Solution</h2>
          <p className="text-xl text-gray-300 mb-8">
            Organize your inbox like a folder structure using Gmail labels — automatically.
          </p>
          <p className="text-lg text-gray-400">
            LabelFlow helps you discover, group, and label emails without manual work.
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-32 bg-background/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-white mb-6">Benefits</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-black/20 backdrop-blur-lg border border-white/10 rounded-2xl p-6 hover:border-cyan-400/50 hover:bg-black/30 transition-all duration-300">
              <p className="text-gray-300 leading-relaxed">Instantly know when someone important emails you</p>
            </div>
            <div className="bg-black/20 backdrop-blur-lg border border-white/10 rounded-2xl p-6 hover:border-purple-400/50 hover:bg-black/30 transition-all duration-300">
              <p className="text-gray-300 leading-relaxed">Build automated email pipelines</p>
            </div>
            <div className="bg-black/20 backdrop-blur-lg border border-white/10 rounded-2xl p-6 hover:border-green-400/50 hover:bg-black/30 transition-all duration-300">
              <p className="text-gray-300 leading-relaxed">Keep your inbox clean and lightweight</p>
            </div>
            <div className="bg-black/20 backdrop-blur-lg border border-white/10 rounded-2xl p-6 hover:border-blue-400/50 hover:bg-black/30 transition-all duration-300">
              <p className="text-gray-300 leading-relaxed">Search faster with meaningful labels</p>
            </div>
          </div>
        </div>
      </section>

      {/* Labeling, Done Right */}
      <section className="py-32 bg-gradient-to-r from-purple-900/20 via-pink-900/20 to-black/20 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-5xl font-bold text-white mb-6">Labeling, Done Right</h2>
          <p className="text-xl text-gray-300 mb-8">An organized inbox starts with effortless labeling.</p>
          <p className="text-lg text-gray-400">
            LabelFlow gives you a smooth, guided flow to create and apply labels — without fighting Gmail's UI.
          </p>
        </div>
      </section>

      {/* The Real Problems with Gmail Labeling */}
      <section className="py-32 bg-background/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-white mb-6">The Real Problems with Gmail Labeling</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-16">
            {/* Managing email addresses */}
            <div className="space-y-6">
              <h3 className="text-3xl font-bold text-cyan-400 mb-4">Managing email addresses</h3>
              <div className="space-y-4 text-gray-300">
                <p>• Gmail doesn't let you list or explore email addresses (FROM, TO, CC, BCC)</p>
                <p>• Large providers (LinkedIn, Google, Stripe, etc.) use multiple sender addresses</p>
                <p>• You want to group senders, not manage them one by one</p>
              </div>
            </div>

            {/* Managing labels and filters */}
            <div className="space-y-6">
              <h3 className="text-3xl font-bold text-purple-400 mb-4">Managing labels and filters</h3>
              <div className="space-y-4 text-gray-300">
                <p>• Labels must be created manually</p>
                <p>• Filters must be created separately</p>
                <p>• Gmail's filter form is:</p>
                <ul className="ml-6 space-y-2">
                  <li>• clunky</li>
                  <li>• non-intuitive</li>
                  <li>• missing autocomplete</li>
                  <li>• You must copy–paste exact email addresses (easy to get wrong)</li>
                </ul>
              </div>
            </div>

            {/* Labeling older emails */}
            <div className="space-y-6 md:col-span-2">
              <h3 className="text-3xl font-bold text-green-400 mb-4">Labeling older emails</h3>
              <div className="space-y-4 text-gray-300">
                <p>• Gmail only labels future emails by default</p>
                <p>• Applying labels to older emails means:</p>
                <ul className="ml-6 space-y-2">
                  <li>• manual pagination</li>
                  <li>• 50 emails per page</li>
                  <li>• constant context switching</li>
                  <li>• It's slow, error-prone, and frustrating</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Software */}
      <section className="py-32 bg-gradient-to-r from-cyan-900/20 via-blue-900/20 to-purple-900/20 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-5xl font-bold text-white mb-6">The Software</h2>
          <p className="text-xl text-gray-300">
            LabelFlow provides an effortless Gmail labeling workflow — end to end.
          </p>
        </div>
      </section>

      {/* How Email Insights Solves This */}
      <section className="py-32 bg-background/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-white mb-6">How LabelFlow Solves This</h2>
          </div>

          <div className="space-y-20">
            {/* 1. Scan & Build Your Contacts Database */}
            <div className="text-center">
              <h3 className="text-4xl font-bold text-cyan-400 mb-6">1. Scan & Build Your Contacts Database</h3>
              <p className="text-xl text-gray-300 mb-8">LabelFlow scans your inbox and builds a contacts database:</p>
              <div className="space-y-4 text-gray-300">
                <p>• Lists all contacted email addresses</p>
                <p>• Enables fast search</p>
                <p>• Groups related senders</p>
                <p>• Helps you decide which labels actually make sense</p>
              </div>
            </div>

            {/* 2. Create Label Rules (Labels + Filters Together) */}
            <div className="text-center">
              <h3 className="text-4xl font-bold text-purple-400 mb-6">
                2. Create Label Rules (Labels + Filters Together)
              </h3>
              <p className="text-xl text-gray-300 mb-8">
                Manage labels and filters in one unified flow using Label Rules:
              </p>
              <div className="space-y-4 text-gray-300">
                <p>• Select contacts directly from your database</p>
                <p>• Assisted autocomplete — no copy–paste</p>
                <p>• Group multiple sender addresses under one rule</p>
                <p>• Create clean, readable label logic</p>
              </div>
            </div>

            {/* 3. Label Older Emails with One Click */}
            <div className="text-center">
              <h3 className="text-4xl font-bold text-green-400 mb-6">3. Label Older Emails with One Click</h3>
              <p className="text-xl text-gray-300 mb-8">Apply your label rules to existing emails using a Label Job:</p>
              <div className="space-y-4 text-gray-300">
                <p>• No pagination</p>
                <p>• No manual steps</p>
                <p>• Works on your entire inbox</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Getting Started */}
      <section className="py-32 bg-gradient-to-r from-purple-900/20 via-pink-900/20 to-black/20 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-5xl font-bold text-white mb-6">Getting Started</h2>
          <div className="space-y-6 text-gray-300">
            <p>• Sign in with your Google account</p>
            <p>• Your inbox is linked instantly</p>
            <p>• Want faster scanning?</p>
            <p>• Enable IMAP access for accelerated processing</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-32 bg-background/50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-white mb-6">FAQ</h2>
          </div>

          <div className="space-y-12">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-cyan-400 mb-4">Does LabelFlow read my emails?</h3>
              <p className="text-gray-300">
                No. Only specific email headers (such as sender and recipient fields) are scanned. Message bodies and
                sensitive content are never read.
              </p>
            </div>

            <div className="text-center">
              <h3 className="text-2xl font-bold text-purple-400 mb-4">Is my data secure?</h3>
              <p className="text-gray-300">
                Yes. LabelFlow follows Google's API security guidelines and uses the minimum permissions required.
              </p>
            </div>

            <div className="text-center">
              <h3 className="text-2xl font-bold text-green-400 mb-4">Can I undo labels?</h3>
              <p className="text-gray-300">Yes. All label rules are reversible and under your control.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 bg-gradient-to-r from-cyan-900/20 via-blue-900/20 to-purple-900/20 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-4xl font-bold text-white mb-6">Take Back Control of Your Inbox</h2>
          <p className="text-xl text-gray-300 mb-12">
            Stop fighting Gmail's filters. Start organizing your inbox the way it should have worked from the beginning.
          </p>
          <p className="text-lg text-gray-400 mb-12">LabelFlow — clarity for your inbox.</p>

          <Button
            size="lg"
            className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white text-2xl px-16 py-6 rounded-2xl shadow-2xl shadow-cyan-500/25 transform hover:scale-105 transition-all duration-300 font-bold"
            onPress={handleGetStarted}
          >
            🚀 Get Started
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-black/30 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-white mb-2">LabelFlow</h3>
            <p className="text-gray-400">Organize your Gmail inbox effortlessly</p>
          </div>
          <div className="flex justify-center space-x-8 text-gray-500">
            <a href="#" className="hover:text-white transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Terms of Service
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Contact
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Support
            </a>
          </div>
          <div className="mt-8 text-sm text-gray-600">© 2024 LabelFlow. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
