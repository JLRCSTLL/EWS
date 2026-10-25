import XCTest
@testable import TANOVIQ

final class AlertContractTests: XCTestCase {
    func testAPNsContentStateDecodesWithActivityKitContract() throws {
        let json = #"{"priority":"critical","message":"TEST ONLY — use the west exit","updatedAt":1792800000,"acknowledged":false}"#
        let state = try JSONDecoder().decode(TANOVIQAlertAttributes.ContentState.self, from: Data(json.utf8))
        XCTAssertEqual(state.message, "TEST ONLY — use the west exit")
        XCTAssertFalse(state.acknowledged)
    }
    func testPublicInboxDateAndUnreadState() throws {
        let json = ##"{"id":"f5c17edb-f813-4a76-b13b-37cba259fcab","content":"TEST ONLY","priority":"high","created_at":"2026-10-24T04:00:00.123Z","read_at":null,"received_at":null,"target_label":"#onsite"}"##
        let alert = try JSONDecoder().decode(AlertMessage.self, from: Data(json.utf8))
        XCTAssertNil(alert.read_at)
        XCTAssertTrue(alert.urgent)
        XCTAssertGreaterThan(alert.date, Date.distantPast)
    }
}
