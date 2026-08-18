/**
 * Centralized API Configuration for Raven Oracle Web Frontend
 * 
 * This module provides a single source of truth for the API base URL.
 * The URL is determined by the NEXT_PUBLIC_API_URL environment variable.
 * 
 * Environment Variable:
 * - NEXT_PUBLIC_API_URL: Full API base URL (e.g., "https://api.ravenoracle.com/api")
 * 
 * Default (Development):
 * - http://localhost:4000/api
 * 
 * Usage:
 * import { API_BASE_URL } from "@/lib/api-config";
 * const response = await fetch(`${API_BASE_URL}/raffles`);
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
