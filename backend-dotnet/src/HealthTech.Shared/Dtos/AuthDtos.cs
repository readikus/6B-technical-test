namespace HealthTech.Shared.Dtos;

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class AuthResponse
{
    public bool Ok { get; set; }
}

public class MeResponse
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
}
