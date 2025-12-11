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
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/50 via-purple-900/30 to-black/80"></div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-32 text-center">
          <div className="mb-8">
            <h1 className="text-7xl font-bold text-white mb-6 bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-300 bg-clip-text text-transparent leading-tight">
              Gmail Insights
            </h1>
            <div className="w-32 h-1 bg-gradient-to-r from-cyan-400 to-purple-400 mx-auto mb-8 rounded-full"></div>
            <p className="text-2xl text-gray-300 max-w-4xl mx-auto mb-8 leading-relaxed">
              Unlock the power of your Gmail data with advanced AI-driven analytics. Discover contact patterns, manage
              labels with precision, and gain deep insights into your email interactions - all in a sleek, modern
              interface.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Button
              size="lg"
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white text-xl px-12 py-4 rounded-xl shadow-2xl shadow-cyan-500/25 transform hover:scale-105 transition-all duration-300 font-semibold"
              onPress={handleGetStarted}
            >
              🚀 Get Started Free
            </Button>
            <Button
              size="lg"
              variant="bordered"
              className="border-2 border-white/30 text-white hover:bg-white/10 text-xl px-12 py-4 rounded-xl backdrop-blur-sm hover:border-white/50 transition-all duration-300 font-semibold"
            >
              📚 View Features
            </Button>
          </div>
        </div>

        {/* Floating Elements */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-cyan-400/20 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute top-40 right-20 w-32 h-32 bg-purple-500/20 rounded-full blur-xl animate-pulse animation-delay-1000"></div>
        <div className="absolute bottom-20 left-1/4 w-24 h-24 bg-blue-400/20 rounded-full blur-xl animate-pulse animation-delay-2000"></div>
      </section>

      {/* Features Section */}
      <section className="py-32 bg-background/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-white mb-6">Powerful Features</h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Everything you need to master your Gmail data and improve your email workflow
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="bg-black/20 backdrop-blur-lg border border-white/10 rounded-2xl p-8 hover:border-cyan-400/50 hover:bg-black/30 transition-all duration-300 group">
              <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl mb-6 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <span className="text-3xl">📧</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Contact Analytics</h3>
              <p className="text-gray-400 leading-relaxed">
                Discover your complete email network with AI-powered analysis. See who you interact with most, track
                communication patterns, and manage your contact database efficiently.
              </p>
            </div>

            <div className="bg-black/20 backdrop-blur-lg border border-white/10 rounded-2xl p-8 hover:border-purple-400/50 hover:bg-black/30 transition-all duration-300 group">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl mb-6 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <span className="text-3xl">🏷️</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Smart Labels</h3>
              <p className="text-gray-400 leading-relaxed">
                Organize your Gmail with advanced label management. Create hierarchical labels, customize colors, and
                sync automatically with your Gmail account for seamless organization.
              </p>
            </div>

            <div className="bg-black/20 backdrop-blur-lg border border-white/10 rounded-2xl p-8 hover:border-green-400/50 hover:bg-black/30 transition-all duration-300 group">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl mb-6 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <span className="text-3xl">📊</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Deep Insights</h3>
              <p className="text-gray-400 leading-relaxed">
                Get actionable insights from your email data. Track message volumes, identify top contacts, and
                understand your communication patterns with detailed analytics and visualizations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 bg-gradient-to-r from-cyan-900/20 via-blue-900/20 to-purple-900/20 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-4xl font-bold text-white mb-6">Ready to Supercharge Your Gmail Workflow?</h2>
          <p className="text-xl text-gray-300 mb-12">
            Connect your Gmail account and unlock powerful insights about your email interactions. Start your journey
            towards better email management today.
          </p>

          <div className="space-y-6">
            <Button
              size="lg"
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white text-2xl px-16 py-6 rounded-2xl shadow-2xl shadow-cyan-500/25 transform hover:scale-105 transition-all duration-300 font-bold"
              onPress={handleGetStarted}
            >
              🚀 Start Analyzing Today
            </Button>
            <p className="text-sm text-gray-500">Free to use • No credit card required • Connect with Google OAuth</p>
          </div>

          {/* Social Proof */}
          <div className="mt-16 grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-cyan-400 mb-2">50K+</div>
              <div className="text-gray-400">Emails Analyzed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400 mb-2">1K+</div>
              <div className="text-gray-400">Active Users</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400 mb-2">99.9%</div>
              <div className="text-gray-400">Uptime</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-black/30 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-white mb-2">Gmail Insights</h3>
            <p className="text-gray-400">Advanced email analytics powered by AI</p>
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
          <div className="mt-8 text-sm text-gray-600">
            © 2024 Gmail Insights. All rights reserved. Built with modern web technologies.
          </div>
        </div>
      </footer>
    </div>
  );
}
