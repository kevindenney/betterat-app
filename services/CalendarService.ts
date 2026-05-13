/**
 * Calendar Service
 * Generates .ics calendar files for coaching sessions and race events
 */

export interface CalendarEvent {
  summary: string;
  description: string;
  location: string;
  startTime: Date;
  endTime: Date;
  organizer?: {
    name: string;
    email: string;
  };
  attendees?: {
    name: string;
    email: string;
  }[];
}

export class CalendarService {
  /**
   * Generate .ics calendar file content
   */
  generateICSFile(event: CalendarEvent): string {
    const formatDate = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const escapeText = (text: string): string => {
      return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
    };

    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//RegattaFlow//Coaching Session//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${Date.now()}@regattaflow.com
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(event.startTime)}
DTEND:${formatDate(event.endTime)}
SUMMARY:${escapeText(event.summary)}
DESCRIPTION:${escapeText(event.description)}
LOCATION:${escapeText(event.location)}`;

    if (event.organizer) {
      icsContent += `\nORGANIZER;CN=${escapeText(event.organizer.name)}:mailto:${event.organizer.email}`;
    }

    if (event.attendees && event.attendees.length > 0) {
      event.attendees.forEach(attendee => {
        icsContent += `\nATTENDEE;CN=${escapeText(attendee.name)};RSVP=TRUE:mailto:${attendee.email}`;
      });
    }

    icsContent += `
STATUS:CONFIRMED
SEQUENCE:0
BEGIN:VALARM
TRIGGER:-PT1H
ACTION:DISPLAY
DESCRIPTION:Reminder: ${escapeText(event.summary)} in 1 hour
END:VALARM
END:VEVENT
END:VCALENDAR`;

    return icsContent;
  }

  /**
   * Generate calendar file for coaching session
   */
  generateCoachingSessionCalendar(params: {
    coachName: string;
    coachEmail: string;
    sailorName: string;
    sailorEmail: string;
    sessionType: string;
    scheduledDate: string;
    durationMinutes: number;
    location: string;
  }): string {
    const startTime = new Date(params.scheduledDate);
    const endTime = new Date(startTime.getTime() + params.durationMinutes * 60000);

    return this.generateICSFile({
      summary: `Coaching Session: ${params.sessionType}`,
      description: `Coaching session with ${params.coachName}\\n\\nType: ${params.sessionType}\\nDuration: ${params.durationMinutes} minutes\\n\\nManaged by RegattaFlow Coach Marketplace`,
      location: params.location,
      startTime,
      endTime,
      organizer: {
        name: params.coachName,
        email: params.coachEmail,
      },
      attendees: [
        {
          name: params.sailorName,
          email: params.sailorEmail,
        },
      ],
    });
  }

  /**
   * Generate calendar file for race event
   */
  generateRaceCalendar(params: {
    regattaName: string;
    venueName: string;
    startDate: string;
    endDate?: string;
    location: string;
    description?: string;
  }): string {
    const startTime = new Date(params.startDate);
    const endTime = params.endDate ? new Date(params.endDate) : new Date(startTime.getTime() + 8 * 60 * 60000); // Default 8 hours

    return this.generateICSFile({
      summary: params.regattaName,
      description: params.description || `Race at ${params.venueName}\\n\\nManaged by RegattaFlow`,
      location: params.location,
      startTime,
      endTime,
    });
  }
}

export const calendarService = new CalendarService();
