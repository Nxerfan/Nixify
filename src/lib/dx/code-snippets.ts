/**
 * Code snippet generator — produces copy-ready examples for every endpoint in
 * 8 languages. Used by the API Playground + docs.
 */

export type Language = "javascript" | "typescript" | "python" | "php" | "go" | "java" | "csharp" | "curl";

export interface SnippetParams {
  method: string;
  path: string;
  baseUrl?: string;
  apiKey?: string;
  body?: Record<string, unknown> | null;
  language: Language;
}

// The canonical production origin is resolved at runtime via getSiteOrigin()
// so code examples never reference a fabricated or stale domain.
import { getSiteOrigin } from "@/lib/site/site-url";

const DEFAULT_BASE = getSiteOrigin();
const DEFAULT_KEY = "mg_live_xxxxxxxxxxxxxxxxxxxxxxxx";

export function generateSnippet(params: SnippetParams): string {
  const base = params.baseUrl || DEFAULT_BASE;
  const key = params.apiKey || DEFAULT_KEY;
  const url = base + params.path;
  const bodyJson = params.body ? JSON.stringify(params.body, null, 2) : null;

  switch (params.language) {
    case "curl": return curlSnippet(url, key, bodyJson);
    case "javascript": return jsSnippet(url, key, bodyJson);
    case "typescript": return tsSnippet(url, key, bodyJson);
    case "python": return pythonSnippet(url, key, bodyJson);
    case "php": return phpSnippet(url, key, bodyJson);
    case "go": return goSnippet(url, key, bodyJson);
    case "java": return javaSnippet(url, key, bodyJson);
    case "csharp": return csharpSnippet(url, key, bodyJson);
    default: return "";
  }
}

function curlSnippet(url: string, key: string, body: string | null): string {
  const lines = [`curl -X POST '${url}' \\`, `  -H 'Authorization: Bearer ${key}' \\`, `  -H 'Content-Type: application/json'`];
  if (body) { lines[lines.length - 1] += " \\"; lines.push(`  -d '${body.replace(/\n/g, "")}'`); }
  return lines.join("\n");
}

function jsSnippet(url: string, key: string, body: string | null): string {
  return `const res = await fetch('${url}', {
  method: '${"POST"}',
  headers: {
    'Authorization': 'Bearer ${key}',
    'Content-Type': 'application/json',
  },${body ? `\n  body: JSON.stringify(${body}),` : ""}
});
const data = await res.json();
console.log(data);`;
}

function tsSnippet(url: string, key: string, body: string | null): string {
  const bodyStr = body ? `\n  body: JSON.stringify(${body}),` : "";
  return `const res = await fetch('${url}', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${key}',
    'Content-Type': 'application/json',
  },${bodyStr}
});
const data = await res.json();
console.log(data);`;
}

function pythonSnippet(url: string, key: string, body: string | null): string {
  return `import requests

res = requests.post(
    '${url}',
    headers={
        'Authorization': 'Bearer ${key}',
        'Content-Type': 'application/json',
    },${body ? `\n    json=${body.replace(/"/g, "'").replace(/\n/g, "\n    ")},` : ""}
)
print(res.json())`;
}

function phpSnippet(url: string, key: string, body: string | null): string {
  return `<?php
$ch = curl_init('${url}');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ${key}',
    'Content-Type: application/json',
]);${body ? `\ncurl_setopt($ch, CURLOPT_POSTFIELDS, '${body.replace(/'/g, "\\'").replace(/\n/g, "")}');` : ""}
$res = curl_exec($ch);
echo $res;`;
}

function goSnippet(url: string, key: string, body: string | null): string {
  return `package main

import (
        "bytes"
        "fmt"
        "net/http"
)

func main() {${body ? `
        body := []bytes(\`${body.replace(/`/g, "\\`")}\`)\n` : ""}
        req, _ := http.NewRequest("POST", "${url}", ${body ? "bytes.NewBuffer(body)" : "nil"})
        req.Header.Set("Authorization", "Bearer ${key}")
        req.Header.Set("Content-Type", "application/json")
        res, _ := http.DefaultClient.Do(req)
        defer res.Body.Close()
        fmt.Println(res.Status)
}`;
}

function javaSnippet(url: string, key: string, body: string | null): string {
  return `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

var client = HttpClient.newHttpClient();
var request = HttpRequest.newBuilder()
    .uri(URI.create("${url}"))
    .header("Authorization", "Bearer ${key}")
    .header("Content-Type", "application/json")${body ? `\n    .POST(HttpRequest.BodyPublishers.ofString("${body.replace(/"/g, "\\\"").replace(/\n/g, "")}"))` : "\n    .POST(HttpRequest.BodyPublishers.noBody())"}
    .build();
var response = client.send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.body());`;
}

function csharpSnippet(url: string, key: string, body: string | null): string {
  return `using var client = new HttpClient();
client.DefaultRequestHeaders.Add("Authorization", "Bearer ${key}");
var content = new StringContent(
    ${body ? `@"${body.replace(/"/g, "\\\"").replace(/\n/g, "")}"` : `""`},
    System.Text.Encoding.UTF8,
    "application/json");
var res = await client.PostAsync("${url}", content);
var body = await res.Content.ReadAsStringAsync();
Console.WriteLine(body);`;
}
