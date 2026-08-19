/**
 * Centralized API Configuration for Raven Oracle Web Frontend
 * 
 * This module provides a single source of truth for the API base URL.
 * Uses same-origin relative paths to avoid CORS and connection issues.
 * 
 * Architecture:
 * - Browser → /api/* (same-origin relative path)
 * - Next.js rewrites (next.config.ts) proxy /api/* → http://localhost:4000/api/*
 * - Express API server listens on localhost:4000
 * 
 * Environment Variable (optional override):
 * - NEXT_PUBLIC_API_URL: Custom API base URL
 * 
 * Default (Production & Development):
 * - /api (same-origin relative path, proxied by Next.js)
 * 
 * Usage:
 * import { API_BASE_URL } from "@/lib/api-config";
 * const response = await fetch(`${API_BASE_URL}/raffles`);
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";
