<script lang="ts">
    import Calendar from "@lucide/svelte/icons/calendar";
    import House from "@lucide/svelte/icons/house";
    import Inbox from "@lucide/svelte/icons/inbox";
    import Search from "@lucide/svelte/icons/search";
    import Settings from "@lucide/svelte/icons/settings";
    import * as Sidebar from "$lib/components/ui/sidebar/index.js";
    import VerticalBarChart from "../charts/VerticalBarChart.svelte";
    
    // Menu items.
    const items = [
     {
      title: "Home",
      url: "#",
      icon: House,
     },
     {
      title: "Inbox",
      url: "#",
      icon: Inbox,
     },
     {
      title: "Calendar",
      url: "#",
      icon: Calendar,
     },
     {
      title: "Search",
      url: "#",
      icon: Search,
     },
     {
      title: "Settings",
      url: "#",
      icon: Settings,
     },
    ];
   </script>
    
   <Sidebar.Root side='right'>
    <Sidebar.Content>
     <Sidebar.Group>
      <Sidebar.GroupLabel>Application</Sidebar.GroupLabel>
      <Sidebar.GroupContent>

        <VerticalBarChart />
       </Sidebar.GroupContent>

     </Sidebar.Group>
    </Sidebar.Content>
   </Sidebar.Root>