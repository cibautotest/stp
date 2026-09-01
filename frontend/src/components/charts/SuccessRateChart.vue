<template>
  <div ref="chartRef" class="chart-container" :style="{ height: height + 'px' }"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'

interface ProjectBoxData {
  name: string
  min: number
  avg: number
  max: number
}

const props = withDefaults(
  defineProps<{
    data: ProjectBoxData[]
    height?: number
  }>(),
  { height: 300 }
)

const chartRef = ref<HTMLElement>()
let chart: echarts.ECharts | null = null

const initChart = () => {
  if (!chartRef.value || !props.data.length) return
  chart = echarts.init(chartRef.value)

  const names = props.data.map(d => d.name)
  // boxplot data: [min, Q1, median(Q2), Q3, max] — use min as lowest, avg as median, max as highest
  const boxData = props.data.map(d => [d.min, d.avg - (d.avg - d.min) * 0.3, d.avg, d.avg + (d.max - d.avg) * 0.3, d.max])
  const avgData = props.data.map(d => ({ value: d.avg, name: d.name }))

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const idx = params[0].dataIndex
        const d = props.data[idx]
        return `<b>${d.name}</b><br/>
                最高: ${d.max.toFixed(2)}%<br/>
                平均: ${d.avg.toFixed(2)}%<br/>
                最低: ${d.min.toFixed(2)}%`
      }
    },
    grid: { left: '3%', right: '4%', bottom: '14%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: names,
      axisLabel: { interval: 0, rotate: 30, fontSize: 12 }
    },
    yAxis: {
      type: 'value',
      name: '成功率(%)',
      min: 0,
      max: 105,
      axisLabel: { formatter: '{value}%' }
    },
    series: [
      {
        name: '成功率范围',
        type: 'boxplot',
        data: boxData,
        boxWidth: ['40%', '60%'],
        itemStyle: { color: '#409eff', borderColor: '#2a6eb0' },
        lineStyle: { width: 2 },
        tooltip: { show: false }
      },
      {
        name: '平均值',
        type: 'scatter',
        data: avgData.map(d => d.value),
        symbol: 'diamond',
        symbolSize: 18,
        itemStyle: { color: '#e6a23c', borderColor: '#d48806', borderWidth: 2 },
        label: {
          show: true,
          position: 'top',
          formatter: (p: any) => `${p.value.toFixed(2)}%`,
          fontSize: 12,
          fontWeight: 'bold',
          color: '#e6a23c'
        }
      }
    ]
  }
  chart.setOption(option)
}

const resizeChart = () => chart?.resize()

watch(() => props.data, () => initChart(), { deep: true })

onMounted(() => { initChart(); window.addEventListener('resize', resizeChart) })
onUnmounted(() => { window.removeEventListener('resize', resizeChart); chart?.dispose() })
</script>

<style scoped>
.chart-container { width: 100%; }
</style>
