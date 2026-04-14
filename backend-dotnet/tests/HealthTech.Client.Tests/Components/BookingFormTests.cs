using Bunit;
using HealthTech.Client.Components;
using HealthTech.Client.Services;
using HealthTech.Shared.Dtos;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;
using Moq;

namespace HealthTech.Client.Tests.Components;

public class BookingFormTests : TestContext
{
    private readonly Mock<ApiClient> _apiMock;

    public BookingFormTests()
    {
        _apiMock = new Mock<ApiClient>(Mock.Of<HttpClient>());
        Services.AddSingleton(_apiMock.Object);
    }

    [Fact]
    public void Renders_AllFormFields()
    {
        // Act
        var cut = RenderComponent<BookingForm>();

        // Assert
        Assert.NotNull(cut.Find("#booking-name"));
        Assert.NotNull(cut.Find("#booking-email"));
        Assert.NotNull(cut.Find("#booking-phone"));
        Assert.NotNull(cut.Find("#booking-description"));
        Assert.NotNull(cut.Find("button[type='submit']"));
    }

    [Fact]
    public void SubmitButton_HasCorrectText()
    {
        // Act
        var cut = RenderComponent<BookingForm>();
        var button = cut.Find("button[type='submit']");

        // Assert
        Assert.Contains("Request Appointment", button.TextContent);
    }

    [Fact]
    public void ShowsValidationErrors_WhenSubmittedEmpty()
    {
        // Arrange
        var cut = RenderComponent<BookingForm>();

        // Act — submit with empty fields
        cut.Find("form").Submit();

        // Assert — should show validation errors
        var errors = cut.FindAll(".form-error");
        Assert.True(errors.Count > 0);
    }

    [Fact]
    public void ShowsSuccessMessage_AfterSuccessfulSubmit()
    {
        // Arrange
        _apiMock
            .Setup(a => a.CreateAppointmentAsync(It.IsAny<CreateAppointmentRequest>()))
            .ReturnsAsync(new AppointmentResponse
            {
                Id = Guid.NewGuid(),
                Name = "Test",
                Email = "test@test.com",
                Phone = "123",
                Description = "Test",
                DateTime = DateTime.UtcNow.AddDays(1),
                Status = "pending",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });

        var cut = RenderComponent<BookingForm>();

        // Fill in valid data
        cut.Find("#booking-name").Change("John Doe");
        cut.Find("#booking-email").Change("john@example.com");
        cut.Find("#booking-phone").Change("+44 7700 900000");
        cut.Find("#booking-description").Change("Annual check-up");

        // Act
        cut.Find("form").Submit();

        // Assert — success message should appear (eventually)
        cut.WaitForState(() => cut.Markup.Contains("Appointment Requested"), TimeSpan.FromSeconds(2));
    }

    [Fact]
    public void FormFields_HaveAriaAttributes()
    {
        // Act
        var cut = RenderComponent<BookingForm>();

        // Assert
        var nameInput = cut.Find("#booking-name");
        Assert.Equal("true", nameInput.GetAttribute("aria-required"));
    }
}
