FROM openjdk:11.0.11-jre-slim

WORKDIR /app

COPY target/eureka-server-*.jar app.jar
EXPOSE 8761
ENTRYPOINT ["java", "-jar", "app.jar"]
