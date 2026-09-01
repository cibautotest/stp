## ADDED Requirements

### Requirement: Service can register with Eureka
The Eureka Server SHALL accept service registration requests from platform-service and engine-service. Each service SHALL send a heartbeat every 30 seconds to maintain its registration status.

#### Scenario: Service registration
- **WHEN** a service starts and sends a POST request to `/eureka/apps/{service-id}`
- **THEN** Eureka SHALL register the service with its hostname, IP address, and port
- **AND** the service SHALL appear in the Eureka dashboard within 5 seconds

#### Scenario: Service heartbeat
- **WHEN** a registered service sends a heartbeat to `/eureka/apps/{service-id}/{instance-id}`
- **THEN** Eureka SHALL renew the service lease for another 90 seconds
- **AND** the service SHALL remain in the registry

#### Scenario: Service deregistration on shutdown
- **WHEN** a service sends a DELETE request to `/eureka/apps/{service-id}/{instance-id}`
- **THEN** Eureka SHALL remove the service from the registry immediately
- **AND** other services SHALL no longer receive this service's address

### Requirement: Service can discover other services
The Eureka Client SHALL allow services to discover other registered services by querying the Eureka registry.

#### Scenario: Client discovers service by name
- **WHEN** a client calls `eurekaClient.getNextServerFromEureka("platform-service", false)`
- **THEN** the client SHALL receive the host and port of an available platform-service instance

#### Scenario: Client handles service unavailable
- **WHEN** a client queries for a service that has no registered instances
- **THEN** the client SHALL receive an exception with message "Service not found"

### Requirement: Eureka Server provides management UI
The Eureka Server SHALL provide a web-based management console at port 8761 for monitoring registered services.

#### Scenario: View registered services
- **WHEN** an administrator navigates to `http://localhost:8761`
- **THEN** the dashboard SHALL display all registered services
- **AND** show each service's instance count, status, and uptime
