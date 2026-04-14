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
        var headers = context.Response.Headers;

        // Content Security Policy — relaxed for Blazor WASM
        headers["Content-Security-Policy"] =
            "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data:; font-src 'self'; connect-src 'self' ws: wss:; " +
            "frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

        headers["Cross-Origin-Resource-Policy"] = "same-site";
        headers["Referrer-Policy"] = "no-referrer";
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["X-XSS-Protection"] = "0";

        // Remove server header
        headers.Remove("Server");

        await _next(context);
    }
}
