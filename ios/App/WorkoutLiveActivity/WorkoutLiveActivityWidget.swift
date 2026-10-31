import ActivityKit
import WidgetKit
import SwiftUI

public struct WorkoutLiveActivityWidget: Widget {
    public init() {}

    public var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
            // =========================================================================
            // 1. LOCK SCREEN LIVE ACTIVITY BANNER (Matching Strava layout from user photo)
            // =========================================================================
            LockScreenLiveActivityView(context: context)
                .activityBackgroundTint(Color.black.opacity(0.85))
                .activitySystemActionForegroundColor(Color.white)
        } dynamicIsland: { context in
            // =========================================================================
            // 2. DYNAMIC ISLAND (Compact, Minimal & Expanded)
            // =========================================================================
            DynamicIsland {
                // EXPANDED DYNAMIC ISLAND
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Image(systemName: "figure.run")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(Color(red: 252/255, green: 82/255, blue: 0/255))
                        Text(context.attributes.workoutTitle)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.white)
                    }
                    .padding(.leading, 6)
                    .padding(.top, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if context.state.currentHeartRate > 40 {
                        HStack(spacing: 3) {
                            Image(systemName: "heart.fill")
                                .font(.system(size: 10))
                                .foregroundColor(.red)
                            Text("\(context.state.currentHeartRate)")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(.white)
                        }
                        .padding(.trailing, 6)
                        .padding(.top, 4)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack(alignment: .top, spacing: 0) {
                        // 1. Temps
                        VStack(spacing: 3) {
                            if context.state.isPaused {
                                Text(formatSeconds(context.state.elapsedTime))
                                    .font(.system(size: 24, weight: .bold, design: .rounded))
                                    .monospacedDigit()
                                    .foregroundColor(.white)
                            } else {
                                Text(timerInterval: context.state.startDate...Date.distantFuture, countsDown: false)
                                    .font(.system(size: 24, weight: .bold, design: .rounded))
                                    .monospacedDigit()
                                    .foregroundColor(.white)
                            }
                            Text("Temps")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(.gray)
                        }
                        .frame(maxWidth: .infinity)

                        // 2. Allure moyenne intermédiaire
                        VStack(spacing: 3) {
                            Text(context.state.paceText)
                                .font(.system(size: 24, weight: .bold, design: .rounded))
                                .monospacedDigit()
                                .foregroundColor(.white)
                            Text("Allure moyenne\nintermédiaire (/km)")
                                .font(.system(size: 9, weight: .medium))
                                .multilineTextAlignment(.center)
                                .foregroundColor(.gray)
                                .lineLimit(2)
                        }
                        .frame(maxWidth: .infinity)

                        // 3. Distance (km)
                        VStack(spacing: 3) {
                            Text(String(format: "%.2f", context.state.distanceKm).replacingOccurrences(of: ".", with: ","))
                                .font(.system(size: 24, weight: .bold, design: .rounded))
                                .monospacedDigit()
                                .foregroundColor(.white)
                            Text("Distance (km)")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(.gray)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .padding(.top, 8)
                    .padding(.bottom, 6)
                }
            } compactLeading: {
                // COMPACT DYNAMIC ISLAND LEADING (Orange Run Icon)
                HStack(spacing: 0) {
                    Image(systemName: "figure.run")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.white)
                        .padding(3.5)
                        .background(Color(red: 252/255, green: 82/255, blue: 0/255))
                        .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
                }
            } compactTrailing: {
                // COMPACT DYNAMIC ISLAND TRAILING (Live Timer)
                if context.state.isPaused {
                    Text(formatSeconds(context.state.elapsedTime))
                        .font(.system(size: 12.5, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(Color(red: 252/255, green: 82/255, blue: 0/255))
                } else {
                    Text(timerInterval: context.state.startDate...Date.distantFuture, countsDown: false)
                        .font(.system(size: 12.5, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(.white)
                        .frame(maxWidth: 46, alignment: .trailing)
                }
            } minimal: {
                // MINIMAL DYNAMIC ISLAND (e.g. when 2 activities are active)
                Image(systemName: "figure.run")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(Color(red: 252/255, green: 82/255, blue: 0/255))
            }
        }
    }
}

// =========================================================================
// LOCK SCREEN BANNER VIEW
// =========================================================================
struct LockScreenLiveActivityView: View {
    let context: ActivityViewContext<WorkoutActivityAttributes>

    var body: some View {
        VStack(spacing: 8) {
            // Header Row: Course à pied + Orange Running Icon
            HStack {
                Spacer()
                Text(context.attributes.workoutTitle)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
                Spacer()
                Image(systemName: "figure.run")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(Color(red: 252/255, green: 82/255, blue: 0/255))
            }
            .padding(.top, 4)

            // 3-Column Metrics Row: Temps | Allure moyenne | Distance
            HStack(alignment: .top, spacing: 0) {
                // 1. Temps
                VStack(spacing: 4) {
                    if context.state.isPaused {
                        Text(formatSeconds(context.state.elapsedTime))
                            .font(.system(size: 26, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .foregroundColor(.white)
                    } else {
                        Text(timerInterval: context.state.startDate...Date.distantFuture, countsDown: false)
                            .font(.system(size: 26, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .foregroundColor(.white)
                    }
                    Text("Temps")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity)

                // 2. Allure moyenne intermédiaire
                VStack(spacing: 4) {
                    Text(context.state.paceText)
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(.white)
                    Text("Allure moyenne\nintermédiaire (/km)")
                        .font(.system(size: 10, weight: .medium))
                        .multilineTextAlignment(.center)
                        .foregroundColor(.gray)
                        .lineLimit(2)
                }
                .frame(maxWidth: .infinity)

                // 3. Distance (km)
                VStack(spacing: 4) {
                    Text(String(format: "%.2f", context.state.distanceKm).replacingOccurrences(of: ".", with: ","))
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(.white)
                    Text("Distance (km)")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity)
            }
            .padding(.bottom, 6)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color(red: 14/255, green: 14/255, blue: 16/255))
    }
}

private func formatSeconds(_ sec: Int) -> String {
    let m = sec / 60
    let s = sec % 60
    if m >= 60 {
        let h = m / 60
        let remM = m % 60
        return String(format: "%d:%02d:%02d", h, remM, s)
    }
    return String(format: "%d:%02d", m, s)
}
