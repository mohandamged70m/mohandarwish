/**
 * Mohand Booking Calendar - Google Apps Script
 * Deploy: script.google.com -> New project -> paste this -> Services + -> Calendar API -> Deploy -> Web app
 * Execute as: Me, Who has access: Anyone with the link (server hides URL via /api/booking)
 * Copy URL to .env.local MEETING_SYNC_URL
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var email = (data.email || "").trim();
    var name = (data.name || "").trim() || "Guest";
    var reason = data.reason || "Meeting";
    var startTime = data.startTime;
    var endTime = data.endTime;

    // Cancel
    if (data.action === "cancel") {
      if (data.eventId) {
        try {
          var ev = CalendarApp.getEventById(data.eventId);
          if (ev) ev.deleteEvent();
        } catch (err) {
          // fallback: search by guest + time
          if (email && startTime) {
            var s = new Date(startTime);
            var en = new Date(s.getTime() + 60 * 60 * 1000);
            var cals = CalendarApp.getAllCalendars();
            for (var ci = 0; ci < cals.length; ci++) {
              var evs = cals[ci].getEvents(s, en);
              for (var ei = 0; ei < evs.length; ei++) {
                var guests = evs[ei].getGuestList();
                for (var gi = 0; gi < guests.length; gi++) {
                  if (guests[gi].getEmail() === email) { try{ evs[ei].deleteEvent(); }catch(_){} break; }
                }
              }
            }
          }
        }
      }
      return json_({ status: "success" });
    }

    // Update
    if (data.action === "update" && data.eventId) {
      var ev2 = CalendarApp.getEventById(data.eventId);
      if (ev2) {
        ev2.setTime(new Date(startTime), new Date(endTime));
        ev2.setTitle(reason + " — " + name);
        ev2.setDescription("Booked via portfolio — " + email + " — " + reason);
        return json_({ status: "success", link: getLink_(ev2), id: ev2.getId() });
      }
    }

    // Create
    var cal = CalendarApp.getDefaultCalendar();
    var ev = cal.createEvent(reason + " — " + name, new Date(startTime), new Date(endTime), {
      guests: email,
      sendInvites: true,
      description: "Booked via mohand-darwish portfolio"
    });

    // Try to add Meet link via Advanced Calendar service
    try {
      var id = ev.getId().split("@")[0];
      var patched = Calendar.Events.patch(
        { conferenceData: { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: "hangoutsMeet" } } } },
        "primary",
        id,
        { conferenceDataVersion: 1, sendUpdates: "all" }
      );
      return json_({ status: "success", link: patched.hangoutLink || getLink_(ev), id: ev.getId() });
    } catch (err2) {
      return json_({ status: "success", link: getLink_(ev), id: ev.getId() });
    }
  } catch (err) {
    return json_({ status: "error", message: err.message });
  }
}

function getLink_(ev) {
  try {
    var id = ev.getId().split("@")[0];
    var full = Calendar.Events.get("primary", id, { conferenceDataVersion: 1 });
    return full.hangoutLink || "";
  } catch (_) { return ""; }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return json_({ status: "ok", message: "Mohand booking script alive" });
}
