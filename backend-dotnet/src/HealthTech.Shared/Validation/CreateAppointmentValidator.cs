using FluentValidation;
using HealthTech.Shared.Dtos;

namespace HealthTech.Shared.Validation;

public class CreateAppointmentValidator : AbstractValidator<CreateAppointmentRequest>
{
    public CreateAppointmentValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required")
            .MaximumLength(200).WithMessage("Name must be 200 characters or fewer");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required")
            .EmailAddress().WithMessage("Invalid email address");

        RuleFor(x => x.Phone)
            .NotEmpty().WithMessage("Phone is required")
            .Matches(@"^[\d\s\+\-\(\)]+$").WithMessage("Invalid phone number format");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Description is required")
            .MaximumLength(2000).WithMessage("Description must be 2000 characters or fewer");

        RuleFor(x => x.DateTime)
            .GreaterThan(System.DateTime.UtcNow).WithMessage("Appointment date must be in the future");
    }
}

public class UpdateAppointmentValidator : AbstractValidator<UpdateAppointmentRequest>
{
    private static readonly string[] ValidStatuses = { "pending", "confirmed", "cancelled" };

    public UpdateAppointmentValidator()
    {
        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("Invalid email address")
            .When(x => x.Email is not null);

        RuleFor(x => x.Phone)
            .Matches(@"^[\d\s\+\-\(\)]+$").WithMessage("Invalid phone number format")
            .When(x => x.Phone is not null);

        RuleFor(x => x.Status)
            .Must(s => ValidStatuses.Contains(s!))
            .WithMessage("Status must be pending, confirmed, or cancelled")
            .When(x => x.Status is not null);
    }
}

public class LoginValidator : AbstractValidator<LoginRequest>
{
    public LoginValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required")
            .EmailAddress().WithMessage("Invalid email address");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required");
    }
}
