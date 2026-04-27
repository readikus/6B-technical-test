using System.Net.Http.Json;
using System.Text.Json;
using HealthTech.Shared.Dtos;

namespace HealthTech.Client.Services;

public class ApiClient
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
    };

    public ApiClient(HttpClient http)
    {
        _http = http;
    }

    public virtual async Task<AppointmentResponse> CreateAppointmentAsync(CreateAppointmentRequest request)
    {
        var response = await _http.PostAsJsonAsync("/api/appointments", request, JsonOptions);
        await EnsureSuccess(response);
        return (await response.Content.ReadFromJsonAsync<AppointmentResponse>(JsonOptions))!;
    }

    public virtual async Task<bool> LoginAsync(string email, string password)
    {
        var response = await _http.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Email = email, Password = password }, JsonOptions);
        return response.IsSuccessStatusCode;
    }

    public virtual async Task LogoutAsync()
    {
        await _http.PostAsync("/api/auth/logout", null);
    }

    public virtual async Task<MeResponse?> GetMeAsync()
    {
        try
        {
            var response = await _http.GetAsync("/api/auth/me");
            if (!response.IsSuccessStatusCode) return null;
            return await response.Content.ReadFromJsonAsync<MeResponse>(JsonOptions);
        }
        catch
        {
            return null;
        }
    }

    public virtual async Task<List<AppointmentResponse>> GetAppointmentsAsync()
    {
        var response = await _http.GetAsync("/api/appointments");
        await EnsureSuccess(response);
        return (await response.Content.ReadFromJsonAsync<List<AppointmentResponse>>(JsonOptions))!;
    }

    public virtual async Task<AppointmentResponse> GetAppointmentAsync(Guid id)
    {
        var response = await _http.GetAsync($"/api/appointments/{id}");
        await EnsureSuccess(response);
        return (await response.Content.ReadFromJsonAsync<AppointmentResponse>(JsonOptions))!;
    }

    public virtual async Task<AppointmentResponse> UpdateAppointmentAsync(Guid id, UpdateAppointmentRequest request)
    {
        var response = await _http.PatchAsJsonAsync($"/api/appointments/{id}", request, JsonOptions);
        await EnsureSuccess(response);
        return (await response.Content.ReadFromJsonAsync<AppointmentResponse>(JsonOptions))!;
    }

    public async Task<AppointmentResponse> ApproveAppointmentAsync(Guid id)
    {
        return await UpdateAppointmentAsync(id, new UpdateAppointmentRequest { Status = "confirmed" });
    }

    public virtual async Task DeleteAppointmentAsync(Guid id)
    {
        var response = await _http.DeleteAsync($"/api/appointments/{id}");
        await EnsureSuccess(response);
    }

    public virtual async Task<List<AuditLogResponse>> GetAuditLogAsync(Guid appointmentId)
    {
        var response = await _http.GetAsync($"/api/appointments/{appointmentId}/audit");
        await EnsureSuccess(response);
        return (await response.Content.ReadFromJsonAsync<List<AuditLogResponse>>(JsonOptions))!;
    }

    private static async Task EnsureSuccess(HttpResponseMessage response)
    {
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync();
            try
            {
                using var doc = JsonDocument.Parse(body);
                var msg = doc.RootElement.TryGetProperty("message", out var m) ? m.ToString() : body;
                throw new HttpRequestException(msg);
            }
            catch (JsonException)
            {
                throw new HttpRequestException(body);
            }
        }
    }
}
