// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "SweepsReliefMacHelper",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "SweepsReliefMacHelper", targets: ["SweepsReliefMacHelper"]),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-crypto.git", from: "3.5.0"),
        .package(url: "https://github.com/apple/swift-argument-parser.git", from: "1.3.0"),
        .package(url: "https://github.com/apple/swift-testing.git", from: "0.6.0"),
    ],
    targets: [
        .target(
            name: "SweepsReliefHelperCore",
            dependencies: [
                .product(name: "Crypto", package: "swift-crypto"),
            ],
            path: "Sources/SweepsReliefHelperCore"
        ),
        .executableTarget(
            name: "SweepsReliefMacHelper",
            dependencies: [
                "SweepsReliefHelperCore",
                .product(name: "ArgumentParser", package: "swift-argument-parser"),
            ],
            path: "Sources/SweepsReliefMacHelper"
        ),
        .testTarget(
            name: "SweepsReliefHelperCoreTests",
            dependencies: [
                "SweepsReliefHelperCore",
                .product(name: "Testing", package: "swift-testing"),
            ],
            path: "Tests/SweepsReliefHelperCoreTests"
        ),
    ]
)
