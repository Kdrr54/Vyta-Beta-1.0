import ActivityKit
import Foundation

public struct WorkoutActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var elapsedTime: Int // in seconds
        public var paceText: String // e.g. "5:12" or "--:--"
        public var distanceKm: Double // e.g. 1.45
        public var currentHeartRate: Int // e.g. 142
        public var isPaused: Bool
        public var startDate: Date

        public init(
            elapsedTime: Int = 0,
            paceText: String = "--:--",
            distanceKm: Double = 0.0,
            currentHeartRate: Int = 0,
            isPaused: Bool = false,
            startDate: Date = Date()
        ) {
            self.elapsedTime = elapsedTime
            self.paceText = paceText
            self.distanceKm = distanceKm
            self.currentHeartRate = currentHeartRate
            self.isPaused = isPaused
            self.startDate = startDate
        }
    }

    public var workoutTitle: String

    public init(workoutTitle: String = "Course à pied") {
        self.workoutTitle = workoutTitle
    }
}
