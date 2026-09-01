import request from './axios'

export interface FaultSimulationRequest {
  projectId?: string
  note?: string
}

export interface FaultSimulationResponse {
  simulationId: string
  scenario: string
  message: string
}

export const triggerFaultSimulation = (scenario: string, data: FaultSimulationRequest) => {
  return request.post<FaultSimulationResponse>(`/platform/fault-simulation/${encodeURIComponent(scenario)}`, data)
}
