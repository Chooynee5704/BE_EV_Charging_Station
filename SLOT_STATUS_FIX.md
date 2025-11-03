# Slot Status Management Fix

## Problem

When booking a reservation, the slot status was not being updated to "booked". The slot remained "available" or was being changed to "in_use" by charging sessions, causing conflicts.

## Root Cause

1. **Reservation Service**: Was updating slot status to "booked" in a transaction ✅ (Already implemented)
2. **Charging Session**: Was NOT checking if slot is already booked before starting
3. **Charging Session Model**: Was NOT automatically updating slot status when session starts/ends

## Solution Implemented

### 1. **Added Slot Availability Check in Reservation Service** ✅

File: `src/services/reservation.service.ts`

```typescript
// Check if all slots are available for booking
const slots = await ChargingSlot.find({ _id: { $in: slotIds } }).lean();
for (const slot of slots) {
  if (slot.status !== "available") {
    const e: any = new Error(
      `Slot ${slot._id} is not available (current status: ${slot.status}). Only available slots can be booked.`
    );
    e.status = 409;
    throw e;
  }
}
```

**Effect**: Now reservations can ONLY be created for slots with status "available".

### 2. **Added Slot Status Check in Charging Service** ✅

File: `src/services/charging.service.ts`

```typescript
// Check if slot is available (not booked or in_use)
if (slot.status === "booked") {
  throw Object.assign(
    new Error("Slot is booked and not available for charging"),
    { status: 409 }
  );
}
if (slot.status === "in_use") {
  throw Object.assign(new Error("Slot is already in use"), { status: 409 });
}
if (slot.status === "inactive") {
  throw Object.assign(new Error("Slot is inactive"), { status: 400 });
}
```

**Effect**: Charging sessions can ONLY start on slots with status "available".

### 3. **Added Auto Status Update in Charging Session Model** ✅

File: `src/models/chargingsession.model.ts`

```typescript
// Pre-save hook: Update slot status to "in_use" when session starts
ChargingSessionSchema.pre("save", async function (next) {
  const session = this as IChargingSession;

  // Only update slot when creating a new active session
  if (session.isNew && session.status === "active") {
    const ChargingSlot = mongoose.model("ChargingSlot");
    await ChargingSlot.findByIdAndUpdate(session.slot, {
      status: "in_use",
    });
  }

  // When session is completed or cancelled, set slot back to available
  if (
    !session.isNew &&
    session.isModified("status") &&
    (session.status === "completed" || session.status === "cancelled")
  ) {
    const ChargingSlot = mongoose.model("ChargingSlot");
    await ChargingSlot.findByIdAndUpdate(session.slot, {
      status: "available",
    });
  }

  next();
});
```

**Effect**:

- When a charging session starts → slot status = "in_use"
- When a charging session ends → slot status = "available"

## Complete Slot Status Lifecycle

```
┌─────────────┐
│  available  │ ◄─── Initial state
└──────┬──────┘
       │
       ├──────► Create Reservation ──────► booked
       │                                      │
       │                                      ├──► Cancel Reservation ──► available
       │                                      │
       │                                      └──► Complete Reservation ─► available
       │
       └──────► Start Charging Session ───► in_use
                                               │
                                               ├──► Stop Session (completed) ──► available
                                               │
                                               └──► Stop Session (cancelled) ──► available
```

## Status Rules

| Status    | Can Book? | Can Charge? | Description                          |
| --------- | --------- | ----------- | ------------------------------------ |
| available | ✅ YES    | ✅ YES      | Slot is free and ready               |
| booked    | ❌ NO     | ❌ NO       | Slot is reserved via reservation     |
| in_use    | ❌ NO     | ❌ NO       | Slot is currently charging a vehicle |
| inactive  | ❌ NO     | ❌ NO       | Slot is disabled/maintenance         |

## API Behavior Changes

### POST /reservations

**Before Fix:**

- Created reservation
- Sometimes slot stayed "available"
- Sometimes slot changed to "in_use" if charging started

**After Fix:**

- ✅ Checks if slot status is "available" before booking
- ✅ Creates reservation
- ✅ Updates slot status to "booked" in same transaction
- ❌ Returns 409 error if slot is not "available"

**Example Error Response:**

```json
{
  "success": false,
  "error": "Conflict",
  "message": "Slot 6905f23a40f17086b8a374fb is not available (current status: in_use). Only available slots can be booked."
}
```

### POST /charging/start

**Before Fix:**

- Started charging session regardless of slot status

**After Fix:**

- ✅ Checks if slot status is "available"
- ✅ Creates charging session
- ✅ Auto-updates slot status to "in_use" (via model hook)
- ❌ Returns 409 error if slot is booked
- ❌ Returns 409 error if slot is already in_use
- ❌ Returns 400 error if slot is inactive

**Example Error Responses:**

```json
{
  "success": false,
  "error": "Conflict",
  "message": "Slot is booked and not available for charging"
}
```

```json
{
  "success": false,
  "error": "Conflict",
  "message": "Slot is already in use"
}
```

### PATCH /reservations/{id}/cancel

**Behavior:**

- ✅ Cancels reservation
- ✅ Updates all slot statuses to "available" in same transaction

### PATCH /reservations/{id}/complete

**Behavior:**

- ✅ Completes reservation
- ✅ Updates all slot statuses to "available" in same transaction

### POST /charging/sessions/{id}/stop

**Behavior:**

- ✅ Stops charging session
- ✅ Auto-updates slot status to "available" (via model hook)

## Testing the Fix

### Test Scenario 1: Book an available slot

```bash
# 1. Check slot status (should be "available")
GET /stations/ports/{portId}/slots

# 2. Create reservation
POST /reservations
{
  "vehicleId": "69023ea3bbf2ab6e559586e8",
  "items": [{
    "slotId": "6905f23a40f17086b8a374fb",
    "startAt": "2025-10-01T10:00:00Z",
    "endAt": "2025-10-01T11:00:00Z"
  }],
  "status": "pending"
}
# Response: 201 Created

# 3. Check slot status again (should be "booked")
GET /stations/ports/{portId}/slots
# Response: status = "booked"
```

### Test Scenario 2: Try to book a slot that's in_use

```bash
# 1. Start charging on a slot
POST /charging/start
{
  "vehicleId": "...",
  "slotId": "6905f23a40f17086b8a374fb",
  "initialPercent": 20,
  "targetPercent": 80
}
# Response: 201 Created, slot status = "in_use"

# 2. Try to book the same slot
POST /reservations
{
  "vehicleId": "...",
  "items": [{
    "slotId": "6905f23a40f17086b8a374fb",
    ...
  }]
}
# Response: 409 Conflict
# Message: "Slot ... is not available (current status: in_use). Only available slots can be booked."
```

### Test Scenario 3: Try to charge a booked slot

```bash
# 1. Create reservation
POST /reservations
{
  "vehicleId": "...",
  "items": [{
    "slotId": "6905f23a40f17086b8a374fb",
    ...
  }]
}
# Response: 201 Created, slot status = "booked"

# 2. Try to start charging on booked slot
POST /charging/start
{
  "slotId": "6905f23a40f17086b8a374fb",
  ...
}
# Response: 409 Conflict
# Message: "Slot is booked and not available for charging"
```

### Test Scenario 4: Cancel reservation

```bash
# 1. Create reservation (slot status = "booked")
POST /reservations

# 2. Cancel reservation
PATCH /reservations/{id}/cancel

# 3. Check slot status (should be "available")
GET /stations/ports/{portId}/slots
# Response: status = "available"
```

## Deployment Checklist

- [x] Update `src/models/chargingsession.model.ts`
- [x] Update `src/services/charging.service.ts`
- [x] Update `src/services/reservation.service.ts`
- [x] Update `src/controllers/reservation.controller.ts`
- [x] Update `src/routes/reservation.routes.ts`
- [ ] Commit changes
- [ ] Push to repository
- [ ] Deploy to Koyeb
- [ ] Test on production

## Deployment Commands

```bash
# Commit changes
git add .
git commit -m "Fix: Add slot status management for reservations and charging sessions"
git push origin main

# Koyeb will auto-deploy from the main branch
```

## Important Notes

1. **Transaction Safety**: All slot status updates in reservations use MongoDB transactions to ensure data consistency.

2. **Model Hooks**: Charging session status updates use Mongoose pre-save hooks for automatic slot status management.

3. **Error Handling**: Both services return proper 409 (Conflict) errors when trying to use unavailable slots.

4. **Status Priority**:

   - Reservations can only be created on "available" slots
   - Charging can only start on "available" slots
   - A booked slot cannot be used for charging
   - An in_use slot cannot be booked

5. **Backwards Compatibility**: Existing data is not affected. The fix only affects new operations.

## Troubleshooting

### Issue: Slot shows "in_use" after booking

**Cause**: A charging session started after the booking.

**Solution**: This is now prevented. Charging sessions will fail with 409 error if slot is booked.

### Issue: Cannot book any slots

**Possible Causes**:

1. All slots are booked, in_use, or inactive
2. Check slot statuses: `GET /stations/ports/{portId}/slots`

**Solution**:

- Cancel unused reservations
- Stop completed charging sessions
- Or wait for slots to become available

### Issue: Deployment doesn't reflect changes

**Possible Causes**:

1. Code not pushed to repository
2. Koyeb not deploying automatically
3. Environment variables issues

**Solution**:

1. Verify git push: `git log --oneline -5`
2. Check Koyeb deployment logs
3. Manually trigger deployment in Koyeb dashboard

## Summary

This fix ensures proper slot status management throughout the entire reservation and charging lifecycle. The slot status now accurately reflects whether a slot is available, booked, or in use, preventing conflicts and double-booking scenarios.
