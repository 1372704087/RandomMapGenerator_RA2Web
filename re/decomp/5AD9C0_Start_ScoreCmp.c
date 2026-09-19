// 0x5ad9c0 Start_ScoreCmp size=22

int __cdecl sub_5AD9C0(_DWORD *a1, _DWORD *a2)
{
  if ( *a1 == *a2 )
    return 0;
  else
    return *a1 >= *a2 ? 1 : -1;
}
