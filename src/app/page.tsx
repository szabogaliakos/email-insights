"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Accordion, AccordionItem } from "@heroui/react";
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
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold text-white mb-6">The Problem</h2>
            <p className="text-xl text-gray-300 mb-12">Your inbox is messy. Important messages disappear.</p>
          </div>

          {/* Images illustrating the problem */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div className="text-center">
              <img
                src="/messy-inbox.png"
                alt="Example of a messy, disorganized Gmail inbox"
                className="w-full rounded-2xl shadow-2xl border border-white/10"
              />
              <p className="text-gray-400 mt-4 text-sm">A typical messy inbox with thousands of unread emails</p>
            </div>
            <div className="text-center">
              <img
                src="/mail-storm.png"
                alt="Overwhelming email storm showing notification overload"
                className="w-full rounded-2xl shadow-2xl border border-white/10"
              />
              <p className="text-gray-400 mt-4 text-sm">Constant email notifications creating information overload</p>
            </div>
          </div>

          <div className="max-w-4xl mx-auto">
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

            <p className="text-lg text-gray-400 mt-12 text-center">
              Gmail labels exist — but managing them at scale is painful.
            </p>
          </div>
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
        <div className="mb-16">
          <div className="max-w-sm mx-auto">
            <img
              src="/nested-labels.png"
              alt="LabelFlow's nested labels showing organized email structure"
              className="w-full rounded-2xl shadow-2xl border border-white/10"
            />
          </div>
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

            <div className="mb-16">
              <div className="max-w-sm mx-auto">
                <img
                  src="/manual-labeling.webp"
                  alt="Manual labeling process in Gmail showing the complexity and pain points"
                  className="w-full rounded-2xl shadow-2xl border border-white/10"
                />
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

      {/* How LabelFlow Solves This - Timeline */}
      <section className="py-32 bg-background/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-white mb-6">How LabelFlow Solves This</h2>
          </div>

          {/* Timeline Container */}
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-gradient-to-b from-primary-500 via-secondary-500 via-success-500 to-warning-500 rounded-full"></div>

            {/* Timeline Items */}
            <div className="space-y-20">
              {/* Step 1 - Scan */}
              <div className="relative flex items-center">
                {/* Timeline Node */}
                <div className="absolute left-1/2 transform -translate-x-1/2 w-16 h-16 bg-primary-500 rounded-full border-4 border-background flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xl">1</span>
                </div>

                {/* Content Card */}
                <div className="w-full max-w-2xl mx-auto ml-8 lg:ml-0 lg:mr-auto lg:pr-8">
                  <div className="bg-background/80 backdrop-blur-lg border border-primary-200/20 rounded-2xl p-8 shadow-xl">
                    <h3 className="text-3xl font-bold text-primary-400 mb-4">Scan</h3>
                    <p className="text-lg text-foreground/80 mb-6">LabelFlow connects to your Gmail account:</p>
                    <div className="space-y-3 text-foreground/70">
                      <p>• Scan your mails with Gmail API</p>
                      <p>• Fast IMAP processing</p>
                      <p>• Build comprehensive contacts database</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2 - Build Contacts Database */}
              <div className="relative flex items-center">
                {/* Timeline Node */}
                <div className="absolute left-1/2 transform -translate-x-1/2 w-16 h-16 bg-secondary-500 rounded-full border-4 border-background flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xl">2</span>
                </div>

                {/* Content Card */}
                <div className="w-full max-w-2xl mx-auto mr-8 lg:mr-0 lg:ml-auto lg:pl-8">
                  <div className="bg-background/80 backdrop-blur-lg border border-secondary-200/20 rounded-2xl p-8 shadow-xl">
                    <h3 className="text-3xl font-bold text-secondary-400 mb-4">Manage your Contacts</h3>
                    <p className="text-lg text-foreground/80 mb-6">Organize and analyze your contact data:</p>
                    <div className="space-y-3 text-foreground/70">
                      <p>• Lists all contacted email addresses</p>
                      <p>• Enables fast search and filtering</p>
                      <p>• Groups related senders automatically</p>
                      <p>• Helps you decide which labels actually make sense</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3 - Create Label Rules */}
              <div className="relative flex items-center">
                {/* Timeline Node */}
                <div className="absolute left-1/2 transform -translate-x-1/2 w-16 h-16 bg-success-500 rounded-full border-4 border-background flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xl">3</span>
                </div>

                {/* Content Card */}
                <div className="w-full max-w-2xl mx-auto ml-8 lg:ml-0 lg:mr-auto lg:pr-8">
                  <div className="bg-background/80 backdrop-blur-lg border border-success-200/20 rounded-2xl p-8 shadow-xl">
                    <h3 className="text-3xl font-bold text-success-400 mb-4">
                      Create Label Rules (Labels + Filters Together)
                    </h3>
                    <p className="text-lg text-foreground/80 mb-6">
                      Manage labels and filters in one unified flow using Label Rules:
                    </p>
                    <div className="space-y-3 text-foreground/70">
                      <p>• Select contacts directly from your database</p>
                      <p>• Assisted autocomplete — no copy–paste</p>
                      <p>• Group multiple sender addresses under one rule</p>
                      <p>• Create clean, readable label logic</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 4 - Label Older Emails */}
              <div className="relative flex items-center">
                {/* Timeline Node */}
                <div className="absolute left-1/2 transform -translate-x-1/2 w-16 h-16 bg-warning-500 rounded-full border-4 border-background flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xl">4</span>
                </div>

                {/* Content Card */}
                <div className="w-full max-w-2xl mx-auto mr-8 lg:mr-0 lg:ml-auto lg:pl-8">
                  <div className="bg-background/80 backdrop-blur-lg border border-warning-200/20 rounded-2xl p-8 shadow-xl">
                    <h3 className="text-3xl font-bold text-warning-400 mb-4">Label Older Emails with One Click</h3>
                    <p className="text-lg text-foreground/80 mb-6">
                      Apply your label rules to existing emails using a Label Job:
                    </p>
                    <div className="space-y-3 text-foreground/70">
                      <p>• No pagination required</p>
                      <p>• No manual steps needed</p>
                      <p>• Works on your entire inbox automatically</p>
                    </div>
                  </div>
                </div>
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

          <Accordion variant="splitted" className="px-0">
            <AccordionItem
              key="1"
              aria-label="Does LabelFlow read my emails?"
              title="Does LabelFlow read my emails?"
              className="text-foreground"
            >
              <p className="text-gray-300">
                No. Only specific email headers (such as sender and recipient fields) are scanned. Message bodies and
                sensitive content are never read.
              </p>
            </AccordionItem>

            <AccordionItem
              key="2"
              aria-label="Is my data secure?"
              title="Is my data secure?"
              className="text-foreground"
            >
              <p className="text-gray-300">
                Yes. LabelFlow follows Google's API security guidelines and uses the minimum permissions required.
              </p>
            </AccordionItem>

            <AccordionItem
              key="3"
              aria-label="Can I undo labels?"
              title="Can I undo labels?"
              className="text-foreground"
            >
              <p className="text-gray-300">Yes. All label rules are reversible and under your control.</p>
            </AccordionItem>
          </Accordion>
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
