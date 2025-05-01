<script lang="ts">
    import * as Sidebar from "$lib/components/ui/sidebar/index.js";
    import VerticalBarChart from  "./charts/VerticalBarChart.svelte"
  
   </script>
    
   <Sidebar.Root side='right'>
    <Sidebar.Content>
     <Sidebar.Group>
      <Sidebar.GroupLabel>Charts</Sidebar.GroupLabel>
      <Sidebar.GroupContent>

        <VerticalBarChart />
       </Sidebar.GroupContent>

     </Sidebar.Group>
    </Sidebar.Content>
   </Sidebar.Root>