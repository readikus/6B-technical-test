using Microsoft.AspNetCore.Components.WebAssembly.Http;

namespace HealthTech.Client.Services;

/// <summary>
/// Ensures every outgoing fetch request includes credentials (cookies).
/// Without this, the browser's fetch API defaults to credentials: 'same-origin'
/// which does NOT send httpOnly cookies set by Set-Cookie headers.
/// </summary>
public class CookieHandler : DelegatingHandler
{
    public CookieHandler() : base(new HttpClientHandler())
    {
    }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        request.SetBrowserRequestCredentials(BrowserRequestCredentials.Include);
        return base.SendAsync(request, cancellationToken);
    }
}
