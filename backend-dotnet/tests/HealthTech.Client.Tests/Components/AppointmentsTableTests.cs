using Bunit;
using HealthTech.Client.Components;
using HealthTech.Shared.Dtos;
using Xunit;

namespace HealthTech.Client.Tests.Components;

public class AppointmentsTableTests : TestContext
{
    private static List<AppointmentResponse> CreateTestAppointments() => new()
    {
        new AppointmentResponse
        {
            Id = Guid.NewGuid(),
            Name = "Alice Smith",
            Email = "alice@test.com",
            Phone = "123-456-7890",
            Description = "Check-up",
            DateTime = DateTime.UtcNow.AddDays(1),
            Status = "pending",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        },
        new AppointmentResponse
        {
            Id = Guid.NewGuid(),
            Name = "Bob Jones",
            Email = "bob@test.com",
            Phone = "098-765-4321",
            Description = "Follow-up",
            DateTime = DateTime.UtcNow.AddDays(2),
            Status = "confirmed",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        },
    };

    [Fact]
    public void Renders_AllAppointmentRows()
    {
        // Arrange
        var appointments = CreateTestAppointments();

        // Act
        var cut = RenderComponent<AppointmentsTable>(parameters => parameters
            .Add(p => p.Appointments, appointments));

        // Assert
        var rows = cut.FindAll("tbody tr");
        Assert.Equal(2, rows.Count);
    }

    [Fact]
    public void Renders_EmptyMessage_WhenNoAppointments()
    {
        // Act
        var cut = RenderComponent<AppointmentsTable>(parameters => parameters
            .Add(p => p.Appointments, new List<AppointmentResponse>()));

        // Assert
        Assert.Contains("No appointments found", cut.Markup);
    }

    [Fact]
    public void ConfirmedRow_HasCorrectClass()
    {
        // Arrange
        var appointments = CreateTestAppointments();

        // Act
        var cut = RenderComponent<AppointmentsTable>(parameters => parameters
            .Add(p => p.Appointments, appointments));

        // Assert — second row (Bob, confirmed) should have row-confirmed class
        var rows = cut.FindAll("tbody tr");
        Assert.Contains("row-confirmed", rows[1].ClassName);
    }

    [Fact]
    public void ApproveButton_NotShown_ForConfirmedAppointment()
    {
        // Arrange
        var appointments = new List<AppointmentResponse>
        {
            new()
            {
                Id = Guid.NewGuid(), Name = "Confirmed", Email = "c@t.com",
                Phone = "123", Description = "Test",
                DateTime = DateTime.UtcNow.AddDays(1),
                Status = "confirmed",
                CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
            },
        };

        // Act
        var cut = RenderComponent<AppointmentsTable>(parameters => parameters
            .Add(p => p.Appointments, appointments));

        // Assert
        var approveButtons = cut.FindAll("button").Where(b => b.TextContent.Contains("Approve"));
        Assert.Empty(approveButtons);
    }

    [Fact]
    public void DeleteButton_ShowsConfirmationDialog()
    {
        // Arrange
        var appointments = CreateTestAppointments();
        var cut = RenderComponent<AppointmentsTable>(parameters => parameters
            .Add(p => p.Appointments, appointments));

        // Act — click Delete on first row
        var deleteButton = cut.FindAll("button").First(b => b.TextContent.Contains("Delete"));
        deleteButton.Click();

        // Assert — confirmation modal appears
        Assert.Contains("Delete Appointment", cut.Markup);
        Assert.Contains("Alice Smith", cut.Markup);
    }

    [Fact]
    public void StatusBadge_ShowsCorrectClass()
    {
        // Arrange
        var appointments = CreateTestAppointments();

        // Act
        var cut = RenderComponent<AppointmentsTable>(parameters => parameters
            .Add(p => p.Appointments, appointments));

        // Assert
        var badges = cut.FindAll(".badge");
        Assert.Contains(badges, b => b.ClassName!.Contains("badge-pending"));
        Assert.Contains(badges, b => b.ClassName!.Contains("badge-confirmed"));
    }
}
