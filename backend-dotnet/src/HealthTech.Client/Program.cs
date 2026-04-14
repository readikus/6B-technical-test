using HealthTech.Client;
using HealthTech.Client.Services;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

// HttpClient with cookie credentials — same origin, so cookies flow automatically
builder.Services.AddScoped(sp =>
{
    var handler = new HttpClientHandler();
    var client = new HttpClient(handler)
    {
        BaseAddress = new Uri(builder.HostEnvironment.BaseAddress)
    };
    return client;
});

builder.Services.AddScoped<ApiClient>();
builder.Services.AddScoped<SignalRService>();
builder.Services.AddScoped<CookieAuthStateProvider>();
builder.Services.AddScoped<AuthenticationStateProvider>(sp =>
    sp.GetRequiredService<CookieAuthStateProvider>());
builder.Services.AddAuthorizationCore();

await builder.Build().RunAsync();
