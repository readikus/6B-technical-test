using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.SignalR.Client;

namespace HealthTech.Client.Services;

public class SignalRService : IAsyncDisposable
{
    private HubConnection? _hubConnection;
    private readonly NavigationManager _navigation;

    public event Action<Guid>? OnAppointmentCreated;

    public SignalRService(NavigationManager navigation)
    {
        _navigation = navigation;
    }

    public async Task StartAsync()
    {
        if (_hubConnection is not null) return;

        _hubConnection = new HubConnectionBuilder()
            .WithUrl(_navigation.ToAbsoluteUri("/hubs/appointments"), options =>
            {
                // Cookies are sent automatically for same-origin connections
            })
            .WithAutomaticReconnect()
            .Build();

        _hubConnection.On<AppointmentCreatedMessage>("AppointmentCreated", msg =>
        {
            OnAppointmentCreated?.Invoke(msg.Id);
        });

        await _hubConnection.StartAsync();
    }

    public async Task StopAsync()
    {
        if (_hubConnection is not null)
        {
            await _hubConnection.StopAsync();
            await _hubConnection.DisposeAsync();
            _hubConnection = null;
        }
    }

    public async ValueTask DisposeAsync()
    {
        await StopAsync();
    }

    private record AppointmentCreatedMessage(Guid Id);
}
