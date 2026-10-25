import XCTest

final class LaunchTests: XCTestCase {
    @MainActor
    func testSignedOutLaunchAndRegistrationNavigation() throws {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.textFields["Username"].waitForExistence(timeout: 20))
        XCTAssertTrue(app.secureTextFields["Password"].exists)
        XCTAssertFalse(app.buttons["Sign in"].isEnabled)
        capture("Sign-in")

        app.buttons["Create an account"].tap()
        XCTAssertTrue(app.textFields["Preferred name"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["Create account"].isEnabled)
        capture("Registration")
        let back = app.buttons["Back to sign in"]
        XCTAssertTrue(back.waitForExistence(timeout: 5))
        XCTAssertTrue(back.isHittable)
        back.tap()
        XCTAssertTrue(app.buttons["Sign in"].exists)
        XCTAssertFalse(app.textFields["Preferred name"].exists)
    }

    @MainActor
    func testSignInRequiresBothCredentials() throws {
        let app = XCUIApplication()
        app.launch()
        let username = app.textFields["Username"]
        XCTAssertTrue(username.waitForExistence(timeout: 20))
        username.tap()
        username.typeText("local_ui_test")
        XCTAssertFalse(app.buttons["Sign in"].isEnabled)
        let password = app.secureTextFields["Password"]
        password.tap()
        password.typeText("LocalOnly-NoRequest123!")
        XCTAssertTrue(app.buttons["Sign in"].isEnabled)
        // Do not submit: this test never creates an account or contacts an inbox.
    }

    @MainActor
    private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
