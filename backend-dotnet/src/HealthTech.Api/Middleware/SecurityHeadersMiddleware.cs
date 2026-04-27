namespace HealthTech.Api.Middleware;

public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Skip security headers on CORS preflight — let the CORS middleware handle it
        if (context.Request.Method == "OPTIONS")
        {
            await _next(context);
            return;
        }

        var headers = context.Response.Headers;

        // Content Security Policy — relaxed for Blazor WASM and cross-origin API access
        headers["Content-Security-Policy"] =
            "default-src 'self'; script-src 'self' 'unsafe-eval' https://cdn.tailwindcss.com; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data:; font-src 'self'; connect-src 'self' ws: wss: http://localhost:*; " +
            "frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

        // Allow cross-origin requests (needed when Next.js frontend calls this API)
        headers["Cross-Origin-Resource-Policy"] = "cross-origin";
        headers["Referrer-Policy"] = "no-referrer";
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["X-XSS-Protection"] = "0";

        // Remove server header
        headers.Remove("Server");

        await _next(context);
    }
}
